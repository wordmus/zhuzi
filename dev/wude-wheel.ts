import { wudeWheel } from '../frameworks/wude-wheel';
import { ELEMENTS } from '../frameworks/wude-wheel/logic';
import { boot, devAct, element } from '../frameworks/jixia-speakers/dev-boot';

const act = devAct('wude-wheel', [element('wude-pointer', 'turn', '青铜盘上的可拖指针'),
  ...ELEMENTS.map((e, i) => element(`virtue-${i}`, 'choose', `${e}德转盘格`))]);
boot(wudeWheel, act).catch(error => console.error(error));
