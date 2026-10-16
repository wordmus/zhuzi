import { gallery } from '../frameworks/gallery';
import { galleryActs } from '../director/pipeline/gallery-plan';
import { bootOne } from './harness';

const act = galleryActs({ maxChars: 30, maxActionsFirst3s: 1, feedbackMs: 100 })[0]!;
bootOne(act, gallery, '导师').catch(console.error);
