import { film } from '../frameworks/film';
import { filmActs } from '../director/pipeline/film-plan';
import { bootOne } from './harness';
bootOne(filmActs({ maxChars: 30, maxActionsFirst3s: 1, feedbackMs: 100 })[0]!, film, '禾、季、田伯').catch(console.error);
