// Job handlers of review requests: send due e-mails, one reminder, expire old requests (every 10 minutes; does nothing while the feature is off).
import { registerHandler, registerRecurring } from './jobs.js';
import { runReviewJob } from './reviewRequests.js';

registerHandler('review_request_send', () => runReviewJob());
registerRecurring('review_request_send', 10 * 60e3);
