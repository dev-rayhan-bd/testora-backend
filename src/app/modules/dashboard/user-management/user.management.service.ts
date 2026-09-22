import User from "../../user/user.model";
import { BadRequestError, NotFoundError } from "../../../errors/request/apiError";

const getUserStats = async () => {
    const baseFilter = {
        deletedAt: null,
        role: { $nin: ['admin', 'super-admin'] },
    };

    const [
        totalUsers,
        allUsers,
    ] = await Promise.all([
        User.countDocuments(baseFilter),
        User.find(baseFilter).lean(),
    ]);

    console.log("Total students/users:", totalUsers);
    const activeAccountUsers = allUsers.filter((u) => u.status === 'active').length;
    const blockedAccountUsers = allUsers.filter((u) => u.status === 'blocked').length;
    const disabledAccountUsers = allUsers.filter((u) => u.status === 'disabled').length;

    return {
        totalUsers,
        activeAccounts: activeAccountUsers,
        blockedAccounts: blockedAccountUsers,
        disabledAccounts: disabledAccountUsers,
    };
};

// get all users
const getAllUsers = async (query: Record<string, unknown>) => {
    const { page = 1, limit = 10, searchTerm, status, plan, role, city } = query;

    const andConditions: any[] = [
        { deletedAt: null },
        { role: { $nin: ['admin', 'super-admin'] } },
    ];
    
    // Status filter
    if (status) andConditions.push({ status });

    // Plan filter
    if (plan && typeof plan === 'string') {
        const cleanPlan = plan.trim().toLowerCase();
        if (cleanPlan === 'all' || cleanPlan === 'all plans') {
            // No filter applied: returns all users
        } else if (cleanPlan === 'free' || cleanPlan === 'none') {
            andConditions.push({
                $or: [
                    { plan: null },
                    { plan: { $exists: false } },
                    { plan: '' },
                    { plan: { $regex: /^free$/i } },
                ],
            });
        } else if (
            cleanPlan === 'semi matura' ||
            cleanPlan === 'semi_matura' ||
            cleanPlan === 'semi-matura'
        ) {
            andConditions.push({
                $or: [
                    { plan: 'semi_matura' },
                    { plan: { $regex: /^semi[ _-]matura$/i } },
                ],
            });
        } else if (cleanPlan === 'matura') {
            andConditions.push({ plan: { $regex: /^matura$/i } });
        } else if (cleanPlan === 'provime' || cleanPlan === 'entrance' || cleanPlan === 'entrance exam') {
            andConditions.push({ plan: { $regex: /^(provime|entrance)/i } });
        } else if (cleanPlan === 'full access' || cleanPlan === 'full-access' || cleanPlan === 'full_access') {
            andConditions.push({ plan: { $regex: /^full[ -_]?access/i } });
        } else {
            andConditions.push({ plan: { $regex: new RegExp(`^${plan.trim()}$`, 'i') } });
        }
    }

    if (role && !['admin', 'super-admin'].includes(String(role).toLowerCase())) {
        andConditions.push({ role });
    }
    if (city) andConditions.push({ city });

    // Search Term logic
    if (searchTerm) {
        andConditions.push({
            $or: [
                { fullName: { $regex: searchTerm, $options: 'i' } },
                { email: { $regex: searchTerm, $options: 'i' } },
            ],
        });
    }

    const matchStage = andConditions.length > 0 ? { $and: andConditions } : {};

    const result = await User.aggregate([
        { $match: matchStage },
        {
            $facet: {
                data: [
                    { $sort: { createdAt: -1 } },
                    { $skip: (Number(page) - 1) * Number(limit) },
                    { $limit: Number(limit) },
                    {
                        $project: {
                            _id: 1,
                            id: '$_id',
                            fullName: 1,
                            email: 1,
                            avatar: 1,
                            plan: {
                                $switch: {
                                    branches: [
                                        {
                                            case: {
                                                $in: ['$plan', ['matura', 'Matura']],
                                            },
                                            then: 'Matura',
                                        },
                                        {
                                            case: {
                                                $in: [
                                                    '$plan',
                                                    [
                                                        'semi_matura',
                                                        'Semi Matura',
                                                        'semi-matura',
                                                    ],
                                                ],
                                            },
                                            then: 'Semi Matura',
                                        },
                                        {
                                            case: {
                                                $in: [
                                                    '$plan',
                                                    [
                                                        'provime',
                                                        'Provime',
                                                        'entrance exam',
                                                        'Entrance Exam',
                                                        'Entrance Exam Package',
                                                    ],
                                                ],
                                            },
                                            then: 'Provime',
                                        },
                                        {
                                            case: {
                                                $in: [
                                                    '$plan',
                                                    [
                                                        'full-access',
                                                        'full_access',
                                                        'Full Access',
                                                        'Full Access Package',
                                                    ],
                                                ],
                                            },
                                            then: 'Full Access',
                                        },
                                    ],
                                    default: { $ifNull: ['$plan', 'Free'] },
                                },
                            },
                            role: 1,
                            faculty: 1,
                            status: 1,
                            city: 1,
                            createdAt: 1,
                        },
                    },
                ],
                total: [{ $count: 'count' }],
            },
        },
    ]);

    const users = result[0]?.data || [];
    const total = result[0]?.total[0]?.count || 0;

    const data = users.map((user: any) => ({
        ...user,
    }));

    return {
        meta: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit)),
        },
        data,
    };
};

const updateUserStatus = async (userId: string, status: string) => {
    const validStatuses = ['active', 'blocked', 'disabled'];
    if (!validStatuses.includes(status)) {
        throw new BadRequestError(
            `Invalid status '${status}'. Must be one of: ${validStatuses.join(', ')}`
        );
    }

    const user = await User.findByIdAndUpdate(
        userId,
        { status },
        { new: true, runValidators: true }
    )
        .select('-password')
        .lean();

    if (!user) {
        throw new NotFoundError('User not found.');
    }

    return user;
};

const getUserById = async (userId: string) => {
    const user: any = await User.findOne({
        _id: userId,
        deletedAt: null,
        role: { $nin: ['admin', 'super-admin'] },
    })
        .select('-password')
        .lean();
    if (!user) {
        throw new NotFoundError('User not found.');
    }

    const formatPlan = (p?: string) => {
        if (!p) return 'Free';
        if (/^semi[ _-]matura$/i.test(p)) return 'Semi Matura';
        if (/^matura$/i.test(p)) return 'Matura';
        if (/^provime$/i.test(p)) return 'Provime';
        return p;
    };

    return {
        ...user,
        plan: formatPlan(user.plan),
    };
};

export const userManagementService = {
    getUserStats,
    getAllUsers,
    updateUserStatus,
    getUserById,
};