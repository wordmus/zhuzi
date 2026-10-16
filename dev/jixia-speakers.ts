import { jixiaSpeakers } from '../frameworks/jixia-speakers';
import { SCHOOLS } from '../frameworks/jixia-speakers/logic';
import { boot, devAct, element } from '../frameworks/jixia-speakers/dev-boot';

const act = devAct('jixia-speakers', SCHOOLS.map((s, i) => element(`school-${i}`, 'choose', `${s}家学派牌`)));
boot(jixiaSpeakers, act).catch(error => console.error(error));
