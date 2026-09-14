/* ============================================================
 * js/bitmaps.js — AI 位图素材登记表（v35）
 * ------------------------------------------------------------
 * 素材：AI 生成的汉代风图标，1024×1024 透明 PNG（已抠底）。
 * 生成规格见 docs/AI图标生成清单.md，落位台账见 docs/图标素材注册表.md。
 * 本文件由 .workbuddy/tools/gen/gen_bitmaps.js 扫描目录自动生成 —— 请勿手改。
 *
 * 用法：BITMAPS.src(group, id) → 相对路径（不存在返回空串，上层走矢量回退）
 * ============================================================ */
var BITMAPS = (function () {
  var DIR = "assets/icons/ui/";
  var F = {};
  F["ai_cangku.png"] = 1;
  F["ai_changqiang.png"] = 1;
  F["ai_chengqiang.png"] = 1;
  F["ai_chihou.png"] = 1;
  F["ai_chongche.png"] = 1;
  F["ai_chuangnu.png"] = 1;
  F["ai_daodun.png"] = 1;
  F["ai_farm.png"] = 1;
  F["ai_fenghuotai.png"] = 1;
  F["ai_forest.png"] = 1;
  F["ai_gold.png"] = 1;
  F["ai_gongjian.png"] = 1;
  F["ai_gongjiangzuofang.png"] = 1;
  F["ai_grain.png"] = 1;
  F["ai_guanfu.png"] = 1;
  F["ai_honglusi.png"] = 1;
  F["ai_hubaoqi.png"] = 1;
  F["ai_iron.png"] = 1;
  F["ai_item_attr_buff.png"] = 1;
  F["ai_item_blueprint.png"] = 1;
  F["ai_item_boost.png"] = 1;
  F["ai_item_build_cost.png"] = 1;
  F["ai_item_exp.png"] = 1;
  F["ai_item_jewel.png"] = 1;
  F["ai_item_military_buff.png"] = 1;
  F["ai_item_mount_buff.png"] = 1;
  F["ai_item_perm.png"] = 1;
  F["ai_item_prod_buff.png"] = 1;
  F["ai_item_stamina.png"] = 1;
  F["ai_junying.png"] = 1;
  F["ai_kezhan.png"] = 1;
  F["ai_majiu.png"] = 1;
  F["ai_mat_bintie.png"] = 1;
  F["ai_mat_cuge.png"] = 1;
  F["ai_mat_fatie.png"] = 1;
  F["ai_mat_heshi.png"] = 1;
  F["ai_mat_jianmu.png"] = 1;
  F["ai_mat_jiaoge.png"] = 1;
  F["ai_mat_jiaojin.png"] = 1;
  F["ai_mat_jingtie.png"] = 1;
  F["ai_mat_kunshan.png"] = 1;
  F["ai_mat_longjin.png"] = 1;
  F["ai_mat_mabu.png"] = 1;
  F["ai_mat_nanmu.png"] = 1;
  F["ai_mat_niujin.png"] = 1;
  F["ai_mat_qingyu.png"] = 1;
  F["ai_mat_shoujin.png"] = 1;
  F["ai_mat_shujin.png"] = 1;
  F["ai_mat_songmu.png"] = 1;
  F["ai_mat_tanmu.png"] = 1;
  F["ai_mat_xiaoge.png"] = 1;
  F["ai_mat_xige.png"] = 1;
  F["ai_mat_xijuan.png"] = 1;
  F["ai_mat_yangzhi.png"] = 1;
  F["ai_mat_yunjin.png"] = 1;
  F["ai_mat_yuntie.png"] = 1;
  F["ai_mine.png"] = 1;
  F["ai_minfang.png"] = 1;
  F["ai_minfu.png"] = 1;
  F["ai_nanjiangxiangbing.png"] = 1;
  F["ai_pop.png"] = 1;
  F["ai_qingji.png"] = 1;
  F["ai_qingzhoubing.png"] = 1;
  F["ai_quarry.png"] = 1;
  F["ai_shichang.png"] = 1;
  F["ai_shuyuan.png"] = 1;
  F["ai_slot_arm.png"] = 1;
  F["ai_slot_back.png"] = 1;
  F["ai_slot_chest.png"] = 1;
  F["ai_slot_feet.png"] = 1;
  F["ai_slot_head.png"] = 1;
  F["ai_slot_mount.png"] = 1;
  F["ai_slot_neck.png"] = 1;
  F["ai_slot_pendant.png"] = 1;
  F["ai_slot_ring.png"] = 1;
  F["ai_slot_shoulder.png"] = 1;
  F["ai_slot_waist.png"] = 1;
  F["ai_slot_weapon.png"] = 1;
  F["ai_stone.png"] = 1;
  F["ai_tengjiabing.png"] = 1;
  F["ai_tieji.png"] = 1;
  F["ai_tiejiangpu.png"] = 1;
  F["ai_toudan.png"] = 1;
  F["ai_tuqibing.png"] = 1;
  F["ai_wood.png"] = 1;
  F["ai_xiaochang.png"] = 1;
  F["ai_xiliangtieqi.png"] = 1;
  F["ai_yibing.png"] = 1;
  F["ai_yizhan.png"] = 1;
  F["ai_zhaoxianguan.png"] = 1;
  F["ai_zhouche.png"] = 1;
  var PREFIX = {
    "terrain": "ai_terrain_",
    "mat": "ai_mat_",
    "slot": "ai_slot_",
    "item": "ai_item_",
    "troop": "ai_",
    "building": "ai_",
    "ext": "ai_",
    "res": "ai_"
  };
  function fileOf(group, id) {
    var p = PREFIX[group]; if (!p) return '';
    var f = p + id + '.png';
    return F[f] ? f : '';
  }
  return {
    DIR: DIR, F: F, PREFIX: PREFIX,
    has: function (f) { return !!F[f]; },
    fileOf: fileOf,
    src: function (group, id) { var f = fileOf(group, id); return f ? DIR + f : ''; },
    count: 91,
  };
})();

/* v36：CommonJS 桥接 —— smoke-test.js 用 require 加载，裸 var 是模块局部，
   icons.js 里的 typeof BITMAPS 会恒为 undefined（素材层静默失效）。 */
if (typeof window !== 'undefined') window.BITMAPS = BITMAPS;
