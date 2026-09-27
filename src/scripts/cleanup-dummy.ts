import mongoose from "mongoose";
import Test from "../app/modules/test/test.model";
import Question from "../app/modules/question/question.model";

mongoose.connect('mongodb+srv://dzeko:sTKCvhTSWLQ07Bfs@cluster0.jx0fabg.mongodb.net/dzeko?appName=Cluster0').then(async () => {
    console.log("Connected to MongoDB.");
    const delTests = await Test.deleteMany({ testCode: { $regex: /^(OFF|ADD)-PROV-/ } });
    const delQuestions = await Question.deleteMany({ questionText: { $regex: /(Official|Additional) Provime Q/ } });
    console.log(`Deleted Dummy Tests: ${delTests.deletedCount}, Deleted Dummy Questions: ${delQuestions.deletedCount}`);
    
    // Now let's fetch all REAL provime questions in the DB
    const realQuestions = await Question.find({ examType: 'provime' }).lean();
    console.log(`Found ${realQuestions.length} real provime questions in DB.`);
    
    // Also fetch the tests 
    const realTests = await Test.find({ examType: 'provime' }).lean();
    console.log(`Found ${realTests.length} real provime tests in DB.`);
    
    mongoose.disconnect();
}).catch(console.error);
