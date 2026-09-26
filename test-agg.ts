import mongoose from "mongoose";
import Test from "./src/app/modules/test/test.model";

mongoose.connect('mongodb+srv://dzeko:sTKCvhTSWLQ07Bfs@cluster0.jx0fabg.mongodb.net/dzeko?appName=Cluster0').then(async () => {
    const tests = await Test.aggregate([
        { $match: { testCode: 'MAT-2024-OFFICIAL-ADD' } },
        { $lookup: { from: 'subjects', localField: 'subjects', foreignField: '_id', as: 'subjectsDetails' } },
        {
            $project: {
                subject: {
                    $cond: {
                        if: { $gt: [{ $size: { $ifNull: ['$subjectsDetails', []] } }, 0] },
                        then: {
                            _id: { $arrayElemAt: ['$subjectsDetails._id', 0] },
                            name: { $arrayElemAt: ['$subjectsDetails.name', 0] }
                        },
                        else: null
                    }
                },
                subjectsDetails: 1,
                subjects: 1
            }
        }
    ]);
    console.log(JSON.stringify(tests, null, 2));
    mongoose.disconnect();
})
