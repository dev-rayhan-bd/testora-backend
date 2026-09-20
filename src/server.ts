import { Server as HTTPServer } from 'http';
import mongoose from 'mongoose';
import app from './app';
import config from './config';
import dns from 'dns';
import { initializeQuizCrons } from './helpers/quizcron';
import { connectSocket } from './socket/connectSocket';
import seedingAdmin from './utilities/seeding';

let server: HTTPServer;
dns.setServers(["1.1.1.1", "8.8.8.8"]);
// handle uncaught exception error
process.on('uncaughtException', (error) => {
  console.log('uncaughtException error', error);
  process.exit(1);
});

const runServer = async () => {
  try {
    await mongoose.connect(config.mongodb_url as string);
    console.log('\x1b[32mDatabase has been connected successfully\x1b[0m');

    initializeQuizCrons();

    const host = '0.0.0.0';

    server = app.listen(config.server_port || 5002, host, () => {
      console.log(
        `\x1b[33mServer is listening on port http://${host}:${config.server_port || 5002}\x1b[0m`,
      );
    });

    await seedingAdmin();     // await if it's async
    connectSocket(server);

  } catch (err) {
    console.error('\x1b[31mFailed to start server:\x1b[0m', err);
    process.exit(1);
  }
};


// handle unhandled rejection
process.on('unhandledRejection', (reason, promise) => {
  console.log(`unhandle rejection at ${promise} and reason ${reason}`);
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

// gracefull shoutdown on SIGTERM
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received.');
  server.close(() => {
    console.log('Server closed.');
  });
});

runServer();
