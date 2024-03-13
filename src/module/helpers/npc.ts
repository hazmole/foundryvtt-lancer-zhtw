import type { HelperOptions } from "handlebars";
import { ActivationType, EntryType, NpcFeatureType } from "../enums";
import { LancerNPC_FEATURE } from "../item/lancer-item";
import { SystemData, SystemTemplates } from "../system-template";
import { slugify } from "../util/lid";
import { chargedBox, effectBox, resolve_helper_dotpath } from "./commons";
import {
  actionTypeIcon,
  loadingIndicator,
  npcAccuracyView,
  npcAttackBonusView,
  damageArrayView,
  rangeArrayView,
} from "./item";
import { limitedUsesIndicator, ref_params } from "./refs";
import { compactTagListHBS } from "./tags";

export const EffectIcons = {
  Generic: `systems/lancer/assets/icons/generic_item.svg`,
  Basic: `systems/lancer/assets/icons/generic_item.svg`,
  Charge: `systems/lancer/assets/icons/mine.svg`,
  Deployable: `systems/lancer/assets/icons/deployable.svg`,
  AI: `systems/lancer/assets/icons/mech_system.svg`,
  Protocol: `systems/lancer/assets/icons/protocol.svg`,
  Reaction: `systems/lancer/assets/icons/reaction.svg`,
  Tech: `systems/lancer/assets/icons/tech_quick.svg`,
  Drone: `systems/lancer/assets/icons/drone.svg`,
  Bonus: `systems/lancer/assets/icons/shape_polygon_plus.svg`,
  Offensive: `systems/lancer/assets/icons/sword_array.svg`,
  Profile: `systems/lancer/assets/icons/weapon_profile.svg`,
};

/* ------------------------------------ */
/* Handlebars Helpers                   */
/* ------------------------------------ */

/**
 * Handlebars helper for effect action type
 */
export function actionTypeSelector(a_type: string, data_target: string): string {
  const a = a_type ? a_type.toLowerCase() : ActivationType.None.toLowerCase();
  let html = '<div class="flexrow flex-center" style="padding: 5px; flex-wrap: nowrap;">';
  html += actionTypeIcon(a_type);
  html += `<select name="${data_target}" data-type="String" style="height: 2em;float: right" >
    <option value="${ActivationType.None}" ${a === ActivationType.None.toLowerCase() ? "selected" : ""}>NONE</option>
    <option value="${ActivationType.Full}" ${a === ActivationType.Full.toLowerCase() ? "selected" : ""}>FULL</option>
    <option value="${ActivationType.Quick}" ${a === ActivationType.Quick.toLowerCase() ? "selected" : ""}>QUICK</option>
    <option value="${ActivationType.Reaction}" ${
    a === ActivationType.Reaction.toLowerCase() ? "selected" : ""
  }>REACTION</option>
    <option value="${ActivationType.Protocol}" ${
    a === ActivationType.Protocol.toLowerCase() ? "selected" : ""
  }>PROTOCOL</option>
    <option value="${ActivationType.Passive}" ${
    a === ActivationType.Passive.toLowerCase() ? "selected" : ""
  }>PASSIVE</option>
    <option value="${ActivationType.Other}" ${a === ActivationType.Other.toLowerCase() ? "selected" : ""}>OTHER</option>
  </select>
  </div>`;
  return html;
}

function npcFeatureScaffold(
  path: string,
  npc_feature: LancerNPC_FEATURE,
  body: string,
  options: HelperOptions
): string {
  let feature_class = `lancer-${slugify(npc_feature.system.type, "-")}`;
  let icon = `cci-${slugify(npc_feature.system.type, "-")}`;
  if (npc_feature.system.type === NpcFeatureType.Tech) icon += "-quick";
  let macro_button = "";
  if (npc_feature.system.type !== NpcFeatureType.Weapon) {
    macro_button = `<a class="chat-flow-button"><i class="mdi mdi-message"></i></a>`;
  }
  return `
  <div class="set ref card ${feature_class}" ${ref_params(npc_feature)}>
    <div class="flexrow lancer-header clipped-top ${npc_feature.system.destroyed ? "destroyed" : ""}">
      <i class="${npc_feature.system.destroyed ? "mdi mdi-cog" : `cci ${icon} i--m i--light`}"> </i>
      ${macro_button}
      <span class="minor grow">${npc_feature.name}</span>
      <a class="lancer-context-menu" data-path="${path}">
        <i class="fas fa-ellipsis-v"></i>
      </a>
    </div>
    ${body}
  </div>`;
}

export function npcReactionView(path: string, options: HelperOptions): string {
  let npc_feature =
    (options.hash["item"] as LancerNPC_FEATURE) ?? resolve_helper_dotpath<LancerNPC_FEATURE>(options, path);
  if (!npc_feature) return "";
  return npcFeatureScaffold(
    path,
    npc_feature,
    `<div class="flexcol lancer-body">
      ${
        npc_feature.system.tags.find(tag => tag.lid === "tg_recharge")
          ? chargedBox(npc_feature.system.charged, path)
          : ""
      }
      ${effectBox("TRIGGER", (npc_feature.system as SystemTemplates.NPC.ReactionData).trigger, { flow: true })}
      ${effectBox("EFFECT", npc_feature.system.effect)}
      ${compactTagListHBS(path + ".system.tags", options)}
    </div>`,
    options
  );
}

// The below 2 funcs just map to this one, because they all do the same thing
export function npcSystemTraitView(path: string, options: HelperOptions): string {
  let npc_feature =
    (options.hash["item"] as LancerNPC_FEATURE) ?? resolve_helper_dotpath<LancerNPC_FEATURE>(options, path);
  if (!npc_feature) return "";
  return npcFeatureScaffold(
    path,
    npc_feature,
    `<div class="flexcol lancer-body">
      ${npc_feature.system.tags.find(tag => tag.lid === "tg_limited") ? limitedUsesIndicator(npc_feature, path) : ""}
      ${
        npc_feature.system.tags.find(tag => tag.lid === "tg_recharge")
          ? chargedBox(npc_feature.system.charged, path)
          : ""
      }
      ${effectBox("EFFECT", npc_feature.system.effect, { flow: true })}
      ${compactTagListHBS(path + ".system.tags", options)}
    </div>`,
    options
  );
}

export function npcTechView(path: string, options: HelperOptions) {
  // Get the feature
  let npc_feature =
    (options.hash["item"] as LancerNPC_FEATURE) ?? resolve_helper_dotpath<LancerNPC_FEATURE>(options, path);
  if (!npc_feature) return "";
  let feature_data = npc_feature.system as SystemTemplates.NPC.TechData;

  // Get the tier (or default 1)
  let tier_index: number = (options.hash["tier"] ?? 1) - 1;

  let sep = `<hr class="vsep">`;
  let subheader_items = [`<a class="roll-tech lancer-button"><i class="fas fa-dice-d20 i--m"></i></a>`];

  let attack_bonus = feature_data.attack_bonus[tier_index];
  let from_sys = false;

  // If we didn't find one, retrieve. Maybe check for undefined as we want an explicit 0 to be a true 0? How to support this in UI?
  if (!attack_bonus) {
    resolve_helper_dotpath(options, "system.systems", 0, true); // A bit lazy. Expand this to cover more cases if needed
    from_sys = true;
  }
  if (attack_bonus) {
    subheader_items.push(npcAttackBonusView(attack_bonus, from_sys ? "ATK (SYS)" : "ATTACK"));
  }

  // Accuracy much simpler. If we got it, we got it
  if (feature_data.accuracy[tier_index]) {
    subheader_items.push(npcAccuracyView(feature_data.accuracy[tier_index]));
  }

  if (feature_data.tags.find(tag => tag.is_recharge)) {
    subheader_items.push(chargedBox(feature_data.charged, path));
  }

  return npcFeatureScaffold(
    path,
    npc_feature,
    `
    <div class="lancer-body flex-col">
      <div class="flexrow">
        ${subheader_items.join(sep)}
      </div>
      <div class="flexcol" style="padding: 0 10px;">
        ${effectBox("EFFECT", feature_data.effect)}
        ${compactTagListHBS(path + ".system.tags", options)}
      </div>
    </div>
    `,
    options
  );
}

export function npcWeaponView(path: string, options: HelperOptions): string {
  // Get the feature
  let npc_feature =
    (options.hash["item"] as LancerNPC_FEATURE) ?? resolve_helper_dotpath<LancerNPC_FEATURE>(options, path);
  if (!npc_feature) return "";
  let feature_data = npc_feature.system as SystemTemplates.NPC.WeaponData;

  let loading: string | undefined;

  // Get the tier (or default 1)
  let tier_index: number = (options.hash["tier"] ?? 1) - 1;

  let sep = `<hr class="vsep">`;
  let subheader_items = [
    `<a class="roll-attack lancer-button no-grow"><i class="fas fa-dice-d20 i--m i--dark"></i></a>`,
  ];

  // Weapon info

  // Topline stuff
  if (feature_data.attack_bonus[tier_index]) {
    subheader_items.push(npcAttackBonusView(feature_data.attack_bonus[tier_index]));
  }
  if (feature_data.accuracy[tier_index]) {
    subheader_items.push(npcAccuracyView(feature_data.accuracy[tier_index]));
  }

  // Get the mid-body stuff. Real meat and potatos of a weapon
  if (feature_data.range.length) {
    subheader_items.push(rangeArrayView(feature_data.range, options));
  }
  if (feature_data.damage[tier_index] && feature_data.damage[tier_index].length) {
    subheader_items.push(damageArrayView(feature_data.damage[tier_index], options));
  }

  if (feature_data.tags.find(tag => tag.lid === "tg_recharge")) {
    subheader_items.push(chargedBox(feature_data.charged, path));
  }

  if (npc_feature.system.tags.some(t => t.is_loading))
    subheader_items.push(loadingIndicator(feature_data.loaded, path));

  return npcFeatureScaffold(
    path,
    npc_feature,
    `
    <div class="lancer-body flex-col">
      <div class="flexrow no-wrap">
        ${subheader_items.join(sep)}
      </div>
      <div>
        <span>${feature_data.weapon_type} // ${npc_feature.system.origin.name} ${
      npc_feature.system.origin.type
    } Feature (TODO ORIGIN)</span>
      </div>
      ${effectBox("ON HIT", feature_data.on_hit)}
      ${effectBox("EFFECT", feature_data.effect)}
      ${compactTagListHBS(path + ".system.tags", options)}
    </div>
    `,
    options
  );
  return "";
}
