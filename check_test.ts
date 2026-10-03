import mongoose from 'mongoose';
import config from './src/config';
import Test from './src/app/modules/test/test.model';

async function run() {
  try {
    await mongoose.connect(config.mongodb_url as string);
    const test = await Test.findOne({ testCode: 'TEST-2026-02' }).lean();
    console.log(JSON.stringify(test, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
run();
