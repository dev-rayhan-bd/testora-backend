import User from "../../user/user.model";
import { BadRequestError, NotFoundError } from "../../../errors/request/apiError";

const getUserStats = async () => {
    const [
        totalUsers,
        allUsers,
    ] = await Promise.all([
        User.countDocuments(),
        User.find({})
            .lean(),
    ]);

   console.log("Total users:", totalUsers);
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

    const matchStage: any = {};
    
    // Status filter
    if (status) matchStage.status = status;
    if (plan) matchStage.plan = plan;
    if (role) matchStage.role = role;
    if (city) matchStage.city = city;

    // Search Term logic
    if (searchTerm) {
        matchStage.$or = [
            { fullName: { $regex: searchTerm, $options: 'i' } },
            { email: { $regex: searchTerm, $options: 'i' } }
        ];
    }

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
                            plan: 1,
                            role: 1,
                            faculty: 1,
                            status: 1,
                            city: 1,
                            createdAt: 1
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
    const user = await User.findById(userId).select('-password').lean();
    if (!user) {
        throw new NotFoundError('User not found.');
    }
    return user;
};

export const userManagementService = {
    getUserStats,
    getAllUsers,
    updateUserStatus,
    getUserById,
};