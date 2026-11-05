// One Express API function; preserve URL routing and discard platform metadata.
import { app } from '../backend/app.ts';
import { vercelExpress } from '../backend/vercel.ts';
export default vercelExpress(app);
