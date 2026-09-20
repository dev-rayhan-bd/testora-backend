import { NextFunction, Request, RequestHandler, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import asyncHandler from '../../shared/asynchandler';
import sendResponse from '../../shared/sendResponse';

//validate request
export const validateRequest = (schemas: { body?: z.ZodType<any>; query?: z.ZodType<any>; params?: z.ZodType<any> }): RequestHandler => {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (schemas.body) {
      console.log(req.body)
      req.body = await schemas.body.parseAsync(req.body);
    }
    if (schemas.query) {
      const parsedQuery = await schemas.query.parseAsync(req.query);
      // Clean out the old unvalidated keys
      for (const key in req.query) { delete req.query[key]; }
      // Safely assign the parsed data into the existing object
      Object.assign(req.query, parsedQuery);
    }

    if (schemas.params) {
      const parsedParams = await schemas.params.parseAsync(req.params);
      // Clean out the old unvalidated keys
      for (const key in req.params) { delete req.params[key]; }
      // Safely assign the parsed data into the existing object
      Object.assign(req.params, parsedParams);
    }
    next();
  });
};

/*

userRouter.patch(
  '/:id',
  validateRequest({
    body: updateUserSchema,
    query: querySchema,
    params: paramsSchema,
  }),
  updateUserHandler
);

*/

// Form Data Request
export const validateFormDataRequest = (schema: z.ZodType<any>) => {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    let payload: any = req.body;

    if (req.body?.data) {
      try {
        payload = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
      } catch (err: any) {
        sendResponse(res, {
          statusCode: StatusCodes.BAD_REQUEST,
          status: 'failed',
          success: false,
          message: 'Invalid JSON string provided in `data` field!',
        });
        return;
      }
    } else if (req.body && Object.keys(req.body).length > 0) {
      // Auto-parse JSON strings, numbers, and booleans for direct multipart fields
      payload = { ...req.body };
      for (const key in payload) {
        if (typeof payload[key] === 'string') {
          const val = payload[key].trim();
          if ((val.startsWith('{') && val.endsWith('}')) || (val.startsWith('[') && val.endsWith(']'))) {
            try {
              payload[key] = JSON.parse(val);
            } catch {
              // keep as string
            }
          } else if (!isNaN(Number(val)) && val !== '') {
            payload[key] = Number(val);
          } else if (val === 'true') {
            payload[key] = true;
          } else if (val === 'false') {
            payload[key] = false;
          }
        }
      }
    }

    req.body = await schema.parseAsync(payload);
    next();
  });
};
