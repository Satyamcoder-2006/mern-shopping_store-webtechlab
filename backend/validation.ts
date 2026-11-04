import { body, validationResult } from 'express-validator';
import type { Request, Response, NextFunction } from 'express';
import { HttpError } from './domain.ts';

// Reject operator/prototype keys recursively. Queries are still built exclusively
// from typed, allowlisted values; validation alone is not a Mongo query sanitizer.
export function rejectOperators(req: Request, _res: Response, next: NextFunction) {
  const inspect = (value: any, depth = 0): boolean => {
    if (depth > 12) return false;
    if (!value || typeof value !== 'object') return true;
    return Object.keys(value).every(key => !key.startsWith('$') && !key.includes('.') && !['__proto__', 'constructor', 'prototype'].includes(key) && inspect(value[key], depth + 1));
  };
  if (!inspect(req.body) || !inspect(req.query)) return next(new HttpError(400, 'Invalid request fields.'));
  next();
}
export const validate = (req: Request, _res: Response, next: NextFunction) => {
  const result = validationResult(req);
  if (!result.isEmpty()) return next(new HttpError(400, 'Please check the submitted fields: ' + result.array().map(e => e.msg).slice(0, 3).join('; ')));
  next();
};
export const signupRules = [body('username').isString().bail().trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2–80 characters'), body('emailId').isString().bail().isEmail().isLength({ max: 254 }), body('age').isInt({ min: 1, max: 120 }), body('password').isString().bail().isLength({ min: 8, max: 128 }), validate];
export const loginRules = [body('emailId').isString().bail().isEmail().isLength({ max: 254 }), body('password').isString().bail().isLength({ min: 1, max: 128 }), validate];

export const faceoffRules = [
  body('title').isString().bail().trim().isLength({ min: 3, max: 140 }),
  body('caption').optional().isString().isLength({ max: 500 }),
  body('publicConsent').equals('true').withMessage('Confirm that your photos will be public'),
  body('looks').isArray({ min: 1, max: 3 }).withMessage('Add between 1 and 3 outfit photos.'),
  body('looks.*.image').isString().matches(/^\/api\/media\/[a-f0-9-]{36}$/),
  body('looks.*.label').isString().bail().trim().isLength({ min: 1, max: 40 }),
  validate,
];
