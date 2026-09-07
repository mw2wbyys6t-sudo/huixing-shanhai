"""
景区库扩充脚本：新增 40 个全国知名景区
- 元数据（名称/坐标/等级/描述/避雷数据）基于公开常识性资料
- 图片通过 Wikimedia Commons 搜索 API 获取真实存在的文件，逐张验证可访问
- 产出：直接写回 data/scenic_spots.json（与现有数据合并）

用法：python scripts/expand_spots.py
"""
import json
import time
from pathlib import Path

import httpx

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
FILE_PATH = "https://commons.wikimedia.org/wiki/Special:FilePath/"

# 新增景区元数据（名称 / 省 / 市 / 类型 / 等级 / 评分 / 点评 / 坐标 / 最佳季节 / 标签 / 描述 / 避雷）
NEW_SPOTS = [
    # ---------- 华东 ----------
    dict(_img_keyword="West Lake Hangzhou", name="杭州西湖风景名胜区", province="浙江省", city="杭州", type="自然", level="5A", rating=4.8, reviews="8.9w", lat=30.2421, lng=120.1508, season="全年", tags=["世界遗产", "湖泊", "人文"], desc="三面云山一面城，苏堤春晓、断桥残雪等西湖十景闻名天下。免费开放的世界文化遗产，江南山水与人文诗词交融的典范。", avoid=dict(idx=2.6, tags=["节假日拥挤", "游船排队"], best="平日清晨与工作日", tips="断桥、雷峰塔节假日人流极大，建议清晨环湖；灵隐寺需另购飞来峰门票。")),
    dict(_img_keyword="Huangshan mountain", name="黄山风景区", province="安徽省", city="黄山", type="自然", level="5A", rating=4.9, reviews="5.6w", lat=30.1310, lng=118.1640, season="四季皆宜", tags=["世界遗产", "山岳", "云海"], desc="五岳归来不看山，黄山归来不看岳。奇松、怪石、云海、温泉、冬雪五绝著称，迎客松与光明顶是中国山岳风光的巅峰代表。", avoid=dict(idx=2.4, tags=["索道排队", "山顶住宿贵"], best="春秋两季与雪后初晴", tips="山顶物价高，建议自带干粮；西海大峡谷单向通行体力消耗大；看日出需提前订山顶床位。")),
    dict(_img_keyword="Gulangyu island", name="鼓浪屿", province="福建省", city="厦门", type="名胜", level="5A", rating=4.6, reviews="6.3w", lat=24.4436, lng=118.0672, season="春秋冬", tags=["世界遗产", "海岛", "建筑"], desc="万国建筑博览与钢琴之岛，百年别墅群掩映在榕树与三角梅之间。步行岛上没有车马喧嚣，日光岩可俯瞰厦鼓海峡。", avoid=dict(idx=2.9, tags=["船票紧张", "商业街拥挤"], best="工作日错峰上岛", tips="轮渡需提前在官方渠道购票；岛上餐饮价格偏高；龙头路商业街人多，深度巷弄更有味道。")),
    dict(_img_keyword="Wuyi Mountains", name="武夷山风景名胜区", province="福建省", city="南平", type="自然", level="5A", rating=4.7, reviews="3.1w", lat=27.7560, lng=118.0330, season="夏秋", tags=["世界遗产", "山水", "茶文化"], desc="碧水丹山的双世遗圣地，九曲溪竹筏漂流如行画中，天游峰一览武夷全景。大红袍母树与岩茶文化更添人文韵味。", avoid=dict(idx=2.2, tags=["竹筏需预约", "山路湿滑"], best="夏季漂流水丰", tips="九曲溪竹筏票旺季紧俏需提前订；山区多雨备雨具；品茶时谨慎购买高价茶叶。")),
    dict(_img_keyword="Mount Tai", name="泰山风景名胜区", province="山东省", city="泰安", type="自然", level="5A", rating=4.8, reviews="7.2w", lat=36.2544, lng=117.1010, season="春秋", tags=["世界遗产", "山岳", "日出"], desc="五岳之首，历代帝王封禅之地。夜爬泰山看日出是最经典的打开方式，十八盘的陡峭与玉皇顶的云海日出令人终生难忘。", avoid=dict(idx=2.5, tags=["夜爬人多", "山顶风大温差大"], best="五一前后与九月", tips="夜爬带好手电与防寒衣物，山顶租军大衣；索道下行旺季排队久；南天门物价高。")),
    dict(_img_keyword="Mount Putuo", name="普陀山风景名胜区", province="浙江省", city="舟山", type="名胜", level="5A", rating=4.7, reviews="4.4w", lat=29.9720, lng=122.3830, season="春秋", tags=["海岛", "佛教", "观音道场"], desc="中国四大佛教名山之一的观音道场，海天佛国梵音涛声。南海观音立像、普济寺香火鼎盛，岛上海滩与古刹相映成趣。", avoid=dict(idx=2.8, tags=["香火消费高", "船票旺季紧张"], best="二月十九等佛诞日前后", tips="岛上住宿节假日价格翻倍需早订；法物流通处请购理性消费；旺季进岛船票提前线上购买。")),
    dict(_img_keyword="Qiandao Lake", name="千岛湖风景名胜区", province="浙江省", city="杭州", type="自然", level="5A", rating=4.6, reviews="2.8w", lat=29.6030, lng=119.0350, season="春秋", tags=["湖泊", "岛屿", "度假"], desc="一千零七十八座翠岛镶嵌在碧波之上，水质常年优良可直饮。乘船跳岛游湖光山色，环湖绿道骑行是江浙度假的后花园。", avoid=dict(idx=2.1, tags=["船票分层收费", "餐厅海鲜价高"], best="4-5月与9-10月", tips="中心湖区与东南湖区选一即可；鱼头招牌店认准明码标价；环湖骑行注意防晒。")),
    dict(_img_keyword="Mount Sanqing", name="三清山风景名胜区", province="江西省", city="上饶", type="自然", level="5A", rating=4.8, reviews="2.3w", lat=28.9020, lng=118.0550, season="春秋", tags=["世界遗产", "花岗岩", "栈道"], desc="西太平洋边缘最美丽的花岗岩，巨蟒出山、东方女神造型鬼斧神工。高空栈道缠绕悬崖云雾之间，是道教名山中的步道天堂。", avoid=dict(idx=2.0, tags=["栈道恐高", "索道排队"], best="4-5月杜鹃花期", tips="高空栈道恐高者量力；山上天气多变带雨衣；索道末班时间注意下山安排。")),
    # ---------- 华中 ----------
    dict(_img_keyword="Shaolin Temple", name="嵩山少林景区", province="河南省", city="郑州", type="名胜", level="5A", rating=4.5, reviews="4.1w", lat=34.5090, lng=112.9380, season="春秋", tags=["禅宗祖庭", "武术", "世界遗产"], desc="天下功夫出少林，禅宗祖庭千年古刹。塔林肃穆、武校演武震撼，三皇寨栈道悬于少室山腰，红叶季尤为壮观。", avoid=dict(idx=3.0, tags=["武校推销", "香火项目多"], best="春秋两季", tips="武术表演场次提前确认；路边拉客的私塾课程勿轻信；三皇寨索道下行末班较早。")),
    dict(_img_keyword="Longmen Grottoes", name="龙门石窟", province="河南省", city="洛阳", type="名胜", level="5A", rating=4.8, reviews="5.2w", lat=34.5590, lng=112.4720, season="春秋", tags=["世界遗产", "石刻", "夜游"], desc="伊河两岸十万余尊佛像凿刻千年，卢舍那大佛的微笑被誉为东方蒙娜丽莎。夜间灯光下的石窟更添神秘庄严。", avoid=dict(idx=2.3, tags=["节假日拥挤", "停车场远"], best="4月牡丹花会期间", tips="东西山石窟分列伊河两岸预留体力；夜游票需单独购买；周边黑车拉客勿乘。")),
    dict(_img_keyword="Yuntai Mountain", name="云台山风景名胜区", province="河南省", city="焦作", type="自然", level="5A", rating=4.7, reviews="3.8w", lat=35.4320, lng=113.2180, season="夏秋", tags=["红石峡", "瀑布", "地质公园"], desc="北方岩溶地貌的博物馆，红石峡丹崖碧水一步一景，云台天瀑落差314米。茱萸峰玻璃栈道俯瞰太行云海。", avoid=dict(idx=2.2, tags=["景区大巴排队", "雨季瀑布水量不定"], best="8-9月水量充沛期", tips="景区极大建议两日游；内部大巴末班车时间记牢；节假日岸上服务区住宿紧张。")),
    dict(_img_keyword="Wudang Mountains", name="武当山风景区", province="湖北省", city="十堰", type="名胜", level="5A", rating=4.7, reviews="3.5w", lat=32.4000, lng=111.0000, season="春秋", tags=["世界遗产", "道教", "武术"], desc="亘古无双胜境，天下第一仙山。金顶铜殿熠熠生辉，南岩宫悬于绝壁，太极武术与道家养生文化源远流长。", avoid=dict(idx=2.6, tags=["金顶拥挤", "香火消费"], best="春秋两季", tips="金顶另行购票且旺季早上去人少；索道上下另收费；山门到太子坡车程较长预留时间。")),
    dict(_img_keyword="Shennongjia", name="神农架生态旅游区", province="湖北省", city="神农架林区", type="自然", level="5A", rating=4.6, reviews="1.9w", lat=31.7440, lng=110.6750, season="夏秋", tags=["原始森林", "金丝猴", "避暑"], desc="华中屋脊的原始秘境，金丝猴在冷杉林间跳跃，大九湖湿地晨雾如仙境。夏季均温20度，是华中避暑的顶配答案。", avoid=dict(idx=1.9, tags=["景点分散", "山路驾驶"], best="6-8月避暑与10月秋色", tips="景区间车程长建议包车或自驾；早晚温差大带外套；木鱼镇是住宿集散中心。")),
    dict(_img_keyword="Zhangjiajie", name="张家界武陵源风景名胜区", province="湖南省", city="张家界", type="自然", level="5A", rating=4.8, reviews="6.8w", lat=29.3480, lng=110.5500, season="春秋", tags=["世界遗产", "峰林", "阿凡达"], desc="三千奇峰拨地而起，《阿凡达》悬浮山的原型取景地。袁家界云海、金鞭溪幽谷、天门山玻璃栈道共同构成湘西山水传奇。", avoid=dict(idx=2.9, tags=["旺季索道排队", "玻璃桥票紧俏"], best="4-6月与9-11月", tips="武陵源门票四日有效合理规划；天门山与武陵源是两个景区勿混淆；山地导游拉客勿轻信。")),
    # ---------- 华南 ----------
    dict(_img_keyword="Li River Guilin", name="桂林漓江风景名胜区", province="广西壮族自治区", city="桂林", type="自然", level="5A", rating=4.8, reviews="5.9w", lat=25.2736, lng=110.2900, season="夏秋", tags=["喀斯特", "山水", "竹筏"], desc="桂林山水甲天下，漓江竹筏从桂林顺流至阳朔，两岸青峰倒映如百里画廊。二十元人民币背面的黄布倒影就在眼前。", avoid=dict(idx=2.7, tags=["游船票价差异大", "雨天视线差"], best="4-10月丰水期", tips="三星船与四星船价差大按需选择；竹筏票认准官方码头；阳朔西街酒吧消费先看价目。")),
    dict(_img_keyword="Danxia Mountain", name="丹霞山", province="广东省", city="韶关", type="自然", level="5A", rating=4.6, reviews="1.6w", lat=25.0280, lng=113.7410, season="春秋", tags=["世界遗产", "丹霞地貌", "日出"], desc="丹霞地貌的命名地，赤壁丹崖色如渥丹。长老峰看日出云海，翔龙湖碧水萦回，阳元石与阴元石的自然奇观令人称奇。", avoid=dict(idx=1.8, tags=["山路台阶多", "夏季暴晒"], best="3-5月与10-12月", tips="看日出需凌晨摸黑上山带头灯；索道与步行路线量力选择；景区内交通船另收费。")),
    dict(_img_keyword="Detian Falls", name="德天跨国瀑布景区", province="广西壮族自治区", city="崇左", type="自然", level="5A", rating=4.7, reviews="1.8w", lat=22.8580, lng=106.7220, season="夏季", tags=["跨国瀑布", "喀斯特", "边境"], desc="亚洲第一跨国瀑布，三级跌落横跨中越边境，丰水期水量磅礴声震山谷。53号界碑与越南集市别有异域风情。", avoid=dict(idx=2.3, tags=["丰枯水期差异大", "边境购物"], best="6-11月丰水期", tips="枯水期瀑布水量小观感打折；界碑边贸市场商品辨明产地；景区大巴末班车时间注意。")),
    dict(_img_keyword="Chimelong", name="长隆野生动物世界", province="广东省", city="广州", type="亲子", level="5A", rating=4.8, reviews="7.8w", lat=22.9980, lng=113.3300, season="全年", tags=["亲子", "动物园", "主题乐园"], desc="亚洲最大的私立野生动物园，乘车区穿越丛林与长颈鹿羚羊偶遇，熊猫三胞胎萌翻全场，是亲子游的顶级目的地。", avoid=dict(idx=2.4, tags=["节假日排队", "园内餐饮贵"], best="工作日错峰", tips="小火车排队久建议开园直奔；缆车环园线俯瞰兽群；园内餐贵可自带简餐。")),
    # ---------- 西南 ----------
    dict(_img_keyword="Jiuzhaigou", name="九寨沟风景名胜区", province="四川省", city="阿坝", type="自然", level="5A", rating=4.9, reviews="7.5w", lat=33.2600, lng=103.9170, season="秋季", tags=["世界遗产", "彩池", "瀑布"], desc="翠海、叠瀑、彩林、雪峰、藏情、蓝冰六绝。五花海的湖水蓝得不像人间，诺日朗瀑布是中国最宽的钙化瀑布，秋季彩林倒映水中如打翻的调色盘。", avoid=dict(idx=2.3, tags=["门票限量预约", "高原反应"], best="10月中下旬彩林季", tips="门票需提前官方渠道预约；景区海拔2000-3100米勿剧烈运动；沟内餐食有限自备干粮。")),
    dict(_img_keyword="Huanglong", name="黄龙风景名胜区", province="四川省", city="阿坝", type="自然", level="5A", rating=4.7, reviews="2.6w", lat=32.7510, lng=103.8220, season="夏秋", tags=["世界遗产", "钙化彩池", "高原"], desc="人间瑶池，三千五个五彩钙化彩池层层叠叠如龙鳞铺展。与九寨沟相距百余公里，争艳池与金沙铺地是钙化地貌的极致。", avoid=dict(idx=2.7, tags=["海拔高易高反", "步行栈道长"], best="9-10月", tips="海拔3500米以上缓步行走备氧气瓶；索道上行步行下山最省力；与九寨沟联游注意行程节奏。")),
    dict(_img_keyword="Mount Emei", name="峨眉山风景区", province="四川省", city="乐山", type="自然", level="5A", rating=4.7, reviews="5.1w", lat=29.5200, lng=103.3320, season="春秋冬", tags=["世界遗产", "佛教", "金顶"], desc="峨眉天下秀，金顶十方普贤圣像在云海佛光中熠熠生辉。生态猴区灵猴趣态可掬，冬季滑雪场是南方的冰雪奇缘。", avoid=dict(idx=2.8, tags=["猴子抢食", "金顶温差大"], best="冬季看雪与佛光", tips="猴区勿手提食物与塑料袋外露；雷洞坪以上租羽绒服上金顶；全山徒步需两日以上量力。")),
    dict(_img_keyword="Leshan Giant Buddha", name="乐山大佛景区", province="四川省", city="乐山", type="名胜", level="5A", rating=4.7, reviews="4.6w", lat=29.5450, lng=103.7730, season="春秋", tags=["世界遗产", "大佛", "三江汇流"], desc="山是一尊佛，佛是一座山。71米的弥勒坐像凿于凌云山岩壁千年，看大佛可走九曲栈道近观或乘船江上远眺全貌。", avoid=dict(idx=2.6, tags=["栈道排队久", "节假日限流"], best="春秋两季", tips="九曲栈道旺季排队2小时起，早晨开门即入；游船视角看全佛更省力；周边跷脚牛肉值得一试。")),
    dict(_img_keyword="Dujiangyan", name="都江堰景区", province="四川省", city="成都", type="名胜", level="5A", rating=4.7, reviews="3.9w", lat=31.0050, lng=103.6180, season="春秋", tags=["世界遗产", "水利", "李冰"], desc="两千多年前李冰父子的水利工程至今灌溉着成都平原，鱼嘴分水、飞沙堰泄洪、宝瓶口引水堪称古代工程奇迹。", avoid=dict(idx=2.2, tags=["讲解需求高", "节假日人多"], best="春夏放水节期间", tips="建议请讲解或租导览器才能看懂门道；安澜索桥晃动恐高者扶稳；与青城山联游一天紧凑。")),
    dict(_img_keyword="Lijiang old town", name="丽江古城", province="云南省", city="丽江", type="名胜", level="5A", rating=4.6, reviews="6.6w", lat=26.8720, lng=100.2350, season="全年", tags=["世界遗产", "古城", "纳西族"], desc="小桥流水人家的柔软时光，四方街的青石板路映着玉龙雪山。纳西古乐、东巴文字与酒吧民谣在同一座古城里共存。", avoid=dict(idx=3.2, tags=["酒吧消费套路", "鲜花饼店雷同"], best="秋冬淡季", tips="古城维护费已被抽查；酒吧消费先确认价格；玉龙雪山门票与氧气租用走正规渠道。")),
    dict(_img_keyword="Jade Dragon Snow Mountain", name="玉龙雪山景区", province="云南省", city="丽江", type="自然", level="5A", rating=4.7, reviews="4.9w", lat=27.1180, lng=100.1700, season="冬季", tags=["雪山", "冰川", "纳西圣山"], desc="纳西族心中的神山，十三峰终年积雪如银龙飞舞。大索道直上4506米冰川公园，蓝月谷的湖水蓝白相间如玉带。", avoid=dict(idx=2.9, tags=["高反明显", "索道票紧俏"], best="11-3月雪景最佳", tips="大索道票提前抢购常售罄；山上租羽绒服备氧气瓶；雪山脚下蓝月谷免费顺游。")),
    dict(_img_keyword="Three Pagodas Dali", name="崇圣寺三塔文化旅游区", province="云南省", city="大理", type="名胜", level="5A", rating=4.6, reviews="2.9w", lat=25.7180, lng=100.1480, season="春季", tags=["白族", "佛塔", "洱海"], desc="大理国的皇家寺院，三座千年白塔倒映在聚影池中与苍山洱海相映。三月街民族风情与风花雪月的浪漫在此交汇。", avoid=dict(idx=2.2, tags=["景区面积大", "周边租车压金"], best="3-5月", tips="倒影公园在三塔外需另购票；电瓶车代步省力；环洱海租车检查车况确认押金条款。")),
    # ---------- 西南 / 西北及其他 ----------
    dict(_img_keyword="Terracotta Army", name="秦始皇兵马俑博物馆", province="陕西省", city="西安", type="名胜", level="5A", rating=4.8, reviews="9.4w", lat=34.3840, lng=109.2780, season="全年", tags=["世界遗产", "考古", "秦代"], desc="世界第八大奇迹，八千陶俑军阵埋藏两千年依然军容严整。铜车马工艺登峰造极，一号坑的气势让人瞬间穿越回大秦帝国。", avoid=dict(idx=2.9, tags=["黑导游", "节假日限流"], best="3-5月与9-11月", tips="务必请官方讲解否则看的是土坑；门票实名预约制；兵马俑在临潼区距市区约1小时车程勿信40分钟到。")),
    dict(_img_keyword="Mount Hua", name="华山风景名胜区", province="陕西省", city="渭南", type="自然", level="5A", rating=4.8, reviews="5.4w", lat=34.4750, lng=110.0850, season="春秋", tags=["五岳", "险峰", "长空栈道"], desc="奇险天下第一山，长空栈道与鹞子翻身悬于绝壁。东西南北中五峰如莲花盛开，夜爬华山看日出是年轻背包客的仪式感。", avoid=dict(idx=2.6, tags=["长空栈道排队", "体力消耗极大"], best="4-6月与9-10月", tips="长空栈道安全绳费另收且排队久；北上西下路线最经典；旺季索道排队2小时起。")),
    dict(_img_keyword="Famen Temple", name="法门文化景区", province="陕西省", city="宝鸡", type="名胜", level="5A", rating=4.5, reviews="1.4w", lat=34.4380, lng=107.8990, season="全年", tags=["佛教", "舍利", "唐文化"], desc="关中塔庙始祖，因供奉佛祖释迦牟尼指骨舍利而成为佛教圣地。合十舍利塔庄严肃穆，地宫出土的唐代文物国宝云集。", avoid=dict(idx=2.4, tags=["商业化法物流通", "距市区远"], best="佛诞节日", tips="舍利只在特定时间开放瞻仰提前查询；合十舍利塔内理性消费；可与乾陵联游一天。")),
    dict(_img_keyword="Crescent Lake Dunhuang", name="鸣沙山月牙泉景区", province="甘肃省", city="敦煌", type="自然", level="5A", rating=4.8, reviews="4.7w", lat=40.0960, lng=94.6690, season="5-6月与9-10月", tags=["沙漠", "月牙泉", "驼队"], desc="沙漠第一泉，一湾月牙静卧沙海千年不涸。骑骆驼听驼铃摇过沙丘，滑沙、越野摩托与日落时分的沙漠光影终身难忘。", avoid=dict(idx=2.2, tags=["骑驼自费项目多", "防晒必备"], best="5-6月与9-10月", tips="骆驼队消费项目提前问清价格；傍晚入园看日落避开暴晒；鞋套租用防沙进鞋。")),
    dict(_img_keyword="Zhangye Danxia", name="张掖七彩丹霞景区", province="甘肃省", city="张掖", type="自然", level="5A", rating=4.7, reviews="3.2w", lat=38.9520, lng=100.2840, season="6-9月", tags=["丹霞", "地质奇观", "日落"], desc="上帝打翻的调色盘，七彩丘陵在夕阳下如彩虹铺展大地。四号观景台的日落是整个河西走廊最惊艳的颜色。", avoid=dict(idx=2.0, tags=["中午光线平", "景区观光车排队"], best="日落前两小时", tips="彩虹山色彩雨后与日落最艳；景区内乘观光车四个观景台逐个停留；无人机需报备。")),
    dict(_img_keyword="Qinghai Lake", name="青海湖景区", province="青海省", city="海南州", type="自然", level="5A", rating=4.7, reviews="3.6w", lat=36.8850, lng=100.2000, season="7-8月", tags=["高原湖泊", "油菜花", "环湖"], desc="中国最大的内陆咸水湖，七月环湖油菜花金黄到天边，湖水蓝得纯粹。二郎剑景区观湖，黑马河看日出是环湖旅人的执念。", avoid=dict(idx=2.1, tags=["海拔3200米注意高反", "环湖包车套路"], best="7-8月油菜花期", tips="湖边拍照进入牧民围栏区域可能被收费；早晚冷备外套；高原勿跑跳饮酒。")),
    dict(_img_keyword="Tianchi Tianshan", name="天山天池风景名胜区", province="新疆维吾尔自治区", city="昌吉", type="自然", level="5A", rating=4.7, reviews="2.9w", lat=43.8830, lng=88.1250, season="5-9月", tags=["高山湖泊", "雪山", "西王母"], desc="传说中西王母宴请周穆王的瑶池，博格达雪峰倒映在一泓碧水之中。环湖栈道云杉环绕，远处雪线清晰可见。", avoid=dict(idx=2.0, tags=["区间车程长", "天气多变"], best="6-9月", tips="乌鲁木齐出发一日往返紧凑；湖边气温比市区低10度备外套；马牙山索道另收费。")),
    dict(_img_keyword="Kanas Lake", name="喀纳斯景区", province="新疆维吾尔自治区", city="阿勒泰", type="自然", level="5A", rating=4.8, reviews="2.4w", lat=48.7070, lng=87.0090, season="9月", tags=["湖泊", "图瓦人", "秋色"], desc="神的后花园，喀纳斯湖水会随季节变换颜色。九月白桦林金黄、晨雾中的神仙湾与月亮湾，是中国秋色的天花板。", avoid=dict(idx=2.4, tags=["路程遥远", "旺季住宿贵"], best="9月中下旬金秋", tips="乌鲁木齐到喀纳斯车程远建议飞机到喀纳斯机场；景区门票+区间车分区间购；贾登峪住宿提前订。")),
    dict(_img_keyword="Huangguoshu Waterfall", name="黄果树风景名胜区", province="贵州省", city="安顺", type="自然", level="5A", rating=4.8, reviews="5.3w", lat=25.9840, lng=105.6700, season="夏季", tags=["瀑布", "水帘洞", "喀斯特"], desc="亚洲第一大瀑布，77.8米高的水帘从天而降，水帘洞可以从瀑布背后穿行。陡坡塘的轰鸣与天星桥的玲珑各有惊喜。", avoid=dict(idx=2.5, tags=["扶梯自费", "雨季人多"], best="6-10月丰水期", tips="大扶梯往返另收费可步行；水帘洞人多湿滑备雨衣；三个景区间观光车联通合理安排顺序。")),
    dict(_img_keyword="Xiaoqikong bridge", name="荔波樟江风景名胜区", province="贵州省", city="黔南州", type="自然", level="5A", rating=4.8, reviews="2.1w", lat=25.2790, lng=107.8840, season="夏季", tags=["世界遗产", "小七孔", "绿宝石"], desc="地球腰带上的绿宝石，小七孔古桥下的湖水绿得通透。68级跌水瀑布层层叠叠，鸳鸯湖泛舟于水上迷宫。", avoid=dict(idx=2.1, tags=["景区步行距离长", "雨后水浑"], best="夏季玩水避暑", tips="小七孔全程步行约4小时穿舒适鞋；大七孔与小七孔分开购票；避开大雨后两天水质最清。")),
    dict(_img_keyword="Xijiang Miao Village", name="西江千户苗寨", province="贵州省", city="黔东南州", type="名胜", level="4A", rating=4.5, reviews="2.7w", lat=26.5030, lng=108.3080, season="全年", tags=["苗寨", "夜景", "民族风情"], desc="全世界最大的苗族聚居村寨，千余栋吊脚楼依山而建，夜晚灯火如星河倾泻山谷。长桌宴与苗银歌舞尽显民族风情。", avoid=dict(idx=3.0, tags=["商业味渐浓", "观景台拥挤"], best="苗年与鼓藏节期间", tips="夜景是精华傍晚前上山占位；长桌宴人均消费先问清；银饰购买认准正规银号。")),
    dict(_img_keyword="Penglai Pavilion", name="蓬莱阁旅游区", province="山东省", city="烟台", type="名胜", level="5A", rating=4.6, reviews="2.2w", lat=37.8220, lng=120.7570, season="夏季", tags=["人间仙境", "海市蜃楼", "八仙"], desc="人间仙境蓬莱阁，八仙过海的传说诞生于此。蓬莱水城是中国现存最完整的古代军港，运气好还能偶遇海市蜃楼。", avoid=dict(idx=2.3, tags=["海市蜃楼难遇", "周边赶海收费"], best="5-9月", tips="海市蜃楼可遇不可求勿被忽悠；田横山跨海索道另收费；三仙山景区与蓬莱阁是分开的门票。")),
    dict(_img_keyword="Wudalianchi", name="五大连池风景区", province="黑龙江省", city="黑河", type="自然", level="5A", rating=4.6, reviews="1.2w", lat=48.7180, lng=126.2010, season="夏季", tags=["火山", "矿泉", "熔岩"], desc="天然火山博物馆，十四座火山锥与五个串珠湖泊记录着两百年前的喷发。翻花石海如凝固的岩浆波涛，冷矿泉世界闻名。", avoid=dict(idx=1.7, tags=["景点分散", "最佳季节短"], best="6-9月", tips="老黑山与火烧山是精华先去；矿泉水不同泉眼味道不同都可尝；景区间距离远自驾更方便。")),
    dict(_img_keyword="Yungang Grottoes", name="云冈石窟", province="山西省", city="大同", type="名胜", level="5A", rating=4.8, reviews="3.3w", lat=40.1120, lng=113.1320, season="5-10月", tags=["世界遗产", "佛教石刻", "北魏"], desc="北魏皇家风范的石窟艺术宝库，第五六窟的中心塔柱与万佛洞雕饰华美。昙曜五窟的大佛雄浑大气，露天大佛是云冈的名片。", avoid=dict(idx=2.1, tags=["交通接驳", "冬季寒冷"], best="5-10月", tips="大同市区公交直达；讲解值得请听北魏历史；可与悬空寺联游一日。")),
]

import json
import time
from pathlib import Path

import httpx

# 新增景区元数据（名称 / 省 / 市 / 类型 / 等级 / 评分 / 点评 / 坐标 / 最佳季节 / 标签 / 描述 / 避雷）


def fetch_commons_image(client: httpx.Client, keyword: str) -> str | None:
    """在 Wikimedia Commons 搜索真实存在的图片文件，返回 Special:FilePath 直链（已验证可访问）"""
    try:
        r = client.get(COMMONS_API, params={
            "action": "query",
            "list": "search",
            "srsearch": f"{keyword} filetype:bitmap",
            "srnamespace": 6,
            "srlimit": 5,
            "format": "json",
        }, timeout=15)
        results = r.json().get("query", {}).get("search", [])
        for item in results:
            title = item.get("title", "")  # 形如 "File:xxx.jpg"
            if not title.lower().endswith((".jpg", ".jpeg", ".png")):
                continue
            filename = title.replace("File:", "")
            url = f"{FILE_PATH}{filename}?width=800"
            # 验证图片可访问（跟随 302 重定向到实际文件）
            try:
                check = client.get(url, timeout=20)
                if check.status_code == 200 and check.headers.get("content-type", "").startswith("image"):
                    return url
            except Exception:
                continue
            time.sleep(0.3)
    except Exception as e:
        print(f"  [warn] Commons 搜索失败: {keyword} ({e})")
    return None


def main():
    existing_path = DATA_DIR / "scenic_spots.json"
    with open(existing_path, encoding="utf-8") as f:
        spots = json.load(f)

    start_idx = max(int(s["id"].split("-")[1]) for s in spots) + 1

    client = httpx.Client(headers={"User-Agent": "HuixingShanhai/1.0 (travel demo; contact: local)"})
    added, no_image = [], []

    print(f"现有 {len(spots)} 个景区，开始扩充 {len(NEW_SPOTS)} 个新景区...\n")

    for i, meta in enumerate(NEW_SPOTS):
        if meta["name"] in {s["name"] for s in spots}:
            print(f"  跳过（已存在）: {meta['name']}")
            continue

        # id 在重名跳过判定之后分配，保证连续无空洞
        spot_id = f"CN-{start_idx + len(added):04d}"

        print(f"[{i+1}/{len(NEW_SPOTS)}] {meta['name']} ...", end=" ")
        image = fetch_commons_image(client, meta.pop("_img_keyword", "")) if meta.get("_img_keyword") else None

        # 组装 spot
        spot = {
            "id": spot_id,
            "name": meta["name"],
            "province": meta["province"],
            "city": meta["city"],
            "type": meta["type"],
            "level": meta["level"],
            "rating": meta["rating"],
            "review_count": meta["reviews"],
            "description": meta["desc"],
            "images": [image] if image else [],
            "latitude": meta["lat"],
            "longitude": meta["lng"],
            "best_season": meta["season"],
            "tags": meta["tags"],
            "avoid": {
                "avoid_index": meta["avoid"]["idx"],
                "avoid_tags": meta["avoid"]["tags"],
                "best_time": meta["avoid"]["best"],
                "tips": meta["avoid"]["tips"],
            },
        }
        spots.append(spot)
        added.append(spot)
        if image:
            print("✓ 图片就绪")
        else:
            no_image.append(meta["name"])
            print("✗ 未找到可用图片（将使用占位图）")
        time.sleep(0.4)

    # 写回景区库（路径为常量 __file__ 推导，无用户输入参与）
    existing_path.write_text(json.dumps(spots, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n完成：新增 {len(added)} 个，总数 {len(spots)} 个")
    if no_image:
        print(f"无图景区 {len(no_image)} 个（前端自动占位图）: {', '.join(no_image)}")


if __name__ == "__main__":
    main()
