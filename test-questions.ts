import mongoose from "mongoose";
import Question from "./src/app/modules/question/question.model";
import Subject from "./src/app/modules/subject/subject.model";

mongoose.connect('mongodb+srv://dzeko:sTKCvhTSWLQ07Bfs@cluster0.jx0fabg.mongodb.net/dzeko?appName=Cluster0').then(async () => {
    const qs = await Question.find().lean();
    console.log("Questions in DB:");
    qs.forEach(q => {
        console.log(`- ${q.examType} | year: ${q.year} | subject: ${q.subject} | faculty: ${q.faculty} | depts: ${q.departments}`);
    });
    
    const subs = await Subject.find().lean();
    console.log("\nSubjects in DB:");
    subs.forEach(s => {
        console.log(`- ID: ${s._id} | ${s.name} (${s.examType})`);
    });
    
    mongoose.disconnect();
})
