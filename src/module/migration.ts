// @ts-nocheck
// We do not care about this file being super rigorous
import { LANCER } from "./config";
import { handleActorExport } from "./helpers/io";
import { LancerActor, LancerNpcData } from "./actor/lancer-actor";
import { core_update, LCPIndex, LCPManager, updateCore } from "./apps/lcp-manager";
import { LancerItem } from "./item/lancer-item";
import { arrayify_object } from "./helpers/commons";
import { LancerTokenDocument } from "./token";

let lp = LANCER.log_prefix;

/**
 * Perform a system migration for the entire World, applying migrations for Actors, Items, and Compendium packs
 * @return {Promise}      A Promise which resolves once the migration is completed
 */
export const migrateWorld = async function () {
  ui.notifications.info(
    `Applying LANCER System Migration for version ${game.system.data.version}. Please be patient and do not close your game or shut down your server.`,
    { permanent: true }
  );

  // Migrate World Compendium Packs
  await scorchedEarthCompendiums();
  await updateCore(core_update);

  if ((await game.settings.get(game.system.id, LANCER.setting_core_data)) === core_update) {
    // Open the LCP manager for convenience.
    new LCPManager().render(true);

    // Compendium migration succeeded, prompt to migrate actors.
    new Dialog(
      {
        title: `Migration Details`,
        content: `
<h1>Lancer 1.0 Migration - The Big One!</h1>
<div class="desc-text">
<span class="horus--subtle" style="white-space: pre">
WELCOME, LANCER.
     PLEASE STAND BY WHILE WE MAKE SOME CHANGES.
                                  (this won't hurt a bit)
</span></div>
<p>The Lancer system has undergone a huge overhaul since the 0.1.x versions, including changing nearly all
of the data model. As such, there is a <i>lot</i> to migrate! We have done our best to write migration code to 
handle as much as possible, but with a change this big it simply isn't possible to fully migrate everything. Read on
for the details!</p>
<h2>Migration is Not Finished!</h2>
<p>Lancer compendiums have been successfully migrated to core version ${core_update}.
Migration of NPCs, Deployables, and Tokens is continuing in the background, <b>do not log off or close the game</b>
until you see the notification "LANCER System Migration to version ${game.system.data.version} completed".</p>
<h2>Things That Won't Be Migrated</h2>
<ul>
<li>Some world-level Items (those in the Items tab of the sidebar) will not be migrated. If you need them, you will
need to create a new item and fill in the details. (They are not automatically deleted so that you can see which 
ones there are and export their data if you so desire. You should delete them once you no longer need them.)
<ul><li>Pilot Items - pilot armor, pilot weapons, pilot gear, skills, talents, core bonuses, licenses.</li>
<li>Mech-related Items - frames, weapons, systems.</li></ul></li>
<li>Customizations to pilot/mech items may be lost.</li>
<li>Unlinked <i>pilot</i> tokens in scenes. (NPC and deployable tokens will be migrated; 
see the note about NPC stats below.)</li>
<li>Compendiums which were not automatically generated by the 0.1.x system.</li>
</ul>
<h2>Changes to NPC Stats</h2>
<p>Lancer 1.0+ has moved to a model of automatically calculating NPC stats, similar to how Comp/Con does. 
This means that changes to NPC stats need to be made by editing the NPC's Class item or adding NPC Feature items
with the appropriate bonuses (for example, the Reinforced feature from the Veteran template to add +1 structure/stress).
This means that some of your NPC's stats may have changed from what they were in 0.1.x.</p>
<h2>Next Steps - Migrate Pilots</h2>
<p>Next, you need to import all of the LCPs that your pilots require. You must use current, up-to-date
LCPs compatible with Comp/Con. You may also want to move each pilot into their own folder, if you have multiple
pilots with the same type of deployable. Doing so will also help keep track of which mechs belong to which
pilots.</p>
<p>Once all needed LCPs are imported, click the button below to start migrating all of your pilots. 
If you close this window while working on your LCPs, you can migrate your pilots individually by right clicking
on them in the Actors sidebar and clicking "Migrate Pilot". </p>`,
        buttons: {
          accept: {
            label: "Start Pilot Migration",
            callback: async () => {
              await migratePilots();
            },
          },
          cancel: {
            label: "Close",
          },
        },
        default: "cancel",
      },
      {
        width: 800,
      }
    ).render(true);
  } else {
    // Compendium migration failed.
    new Dialog({
      title: `Compendium Migration Failed`,
      content: `
<p>Something went wrong while attempting to build the core data Compendiums for the new Lancer system.
Please refresh the page to try again.</p>`,
      buttons: {
        accept: {
          label: "Refresh",
          callback: async () => {
            ui.notifications.info("Page reloading in 3...");
            await sleep(1000);
            ui.notifications.info("2...");
            await sleep(1000);
            ui.notifications.info("1...");
            await sleep(1000);
            window.location.reload(false);
          },
        },
        cancel: {
          label: "Close",
        },
      },
      default: "accept",
    }).render(true);
  }

  // for (let p of game.packs) {
  //   if (p.metadata.package === "world" && ["Actor", "Item", "Scene"].includes(p.metadata.type)) {
  //     await migrateCompendium(p);
  //   }
  // }

  // Migrate World Actors
  // Only NPCs, not pilots or mechs. GMs gotta update LCPs first.
  for (let a of game.actors.contents) {
    try {
      const updateData = await migrateActorData(a);
      if (!isObjectEmpty(updateData)) {
        console.log(`Migrating Actor ${a.name}`);
        await a.update(updateData);
      }
    } catch (err) {
      console.log(err);
    }
  }

  // Migrate World Items
  for (let i of game.items.contents) {
    try {
      const updateData = await migrateItemData(i);
      if (!isObjectEmpty(updateData)) {
        console.log(`Migrating Item ${i.name}`);
        await i.update(updateData);
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Migrate Actor Override Tokens
  for (let s of game.scenes.contents) {
    try {
      console.log(`Migrating Scene ${s.name}`);
      let updateData = await migrateSceneData(s);
      if (updateData && !isObjectEmpty(updateData)) {
        await s.update(updateData);
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Set the migration as complete
  await game.settings.set(game.system.id, LANCER.setting_migration, game.system.data.version);
  ui.notifications.info(`LANCER System Migration to version ${game.system.data.version} completed!`, {
    permanent: true,
  });
};

export const minor09Migration = async function () {
  // Migrate World Actors
  for (let a of game.actors.contents) {
    try {
      const updateData = await migrateActorData(a, true);
      if (!isObjectEmpty(updateData)) {
        console.log(`Migrating Actor ${a.name}`);
        await a.update(updateData);
      }
    } catch (err) {
      console.log(err);
    }
  }

  // Migrate Actor Override Tokens
  for (let s of game.scenes.contents) {
    try {
      console.log(`Migrating Scene ${s.name}`);
      let updateData = await migrateSceneData(s, true);
      if (updateData && !isObjectEmpty(updateData)) {
        await s.update(updateData);
      }
    } catch (err) {
      console.error(err);
    }
  }

  for (let p of game.packs.contents) {
    if (p.metadata.package === "world" && ["Actor", "Item", "Scene"].includes(p.metadata.type)) {
      await migrateCompendium(p);
    }
  }
};

/* -------------------------------------------- */

const compTitles = {
  old: [
    "Skill Triggers",
    "Talents",
    "Core Bonuses",
    "Pilot Armor",
    "Pilot Weapons",
    "Pilot Gear",
    "Frames",
    "Systems",
    "Weapons",
    "NPC Classes",
    "NPC Templates",
    "NPC Features",
  ],
  new: {
    Actor: ["Deployable"],
    Item: [
      "Core Bonus",
      "Environment",
      "Frame",
      "License",
      "Manufacturer",
      "Mech System",
      "Mech Weapon",
      "Pilot Armor",
      "Pilot Gear",
      "Reserve",
      "Sitrep",
      "Skill",
      "Status/Condition",
      "Tag",
      "Talent",
      "Weapon Mod",
    ],
  },
};

/**
 * Function to migrate old pilots to pilot/mech paradigm.
 * Gathers LIDs of all old pilot items, clears items, then performs a
 * mock-CC import with all of the found LIDs.
 */
export const migratePilots = async () => {
  let count = 0;
  for (let a of game.actors.values()) {
    try {
      if (a.data.type === EntryType.PILOT) {
        const ret = handleActorExport(a, false);
        if (ret) {
          console.log(`== Migrating Actor ${a.name}`);
          await (a as LancerActor).importCC(ret, true);
          console.log(ret);
          count++;
        }
      }
    } catch (err) {
      console.error(err);
      console.error(`== Migrating Actor ${a.name} failed.`);
    }
  }
  ui.notifications.info(`Pilot migration complete! Migrations triggered: ${count}`, { permanent: true });
};

export const scorchedEarthCompendiums = async () => {
  // Remove all packs.
  for (let comp of game.packs.filter(comp => compTitles.old.includes(comp.title))) {
    await comp.configure({ locked: false });
    await comp.deleteCompendium();
    console.debug(`Deleting ${comp.title}`);
  }
  // Build blank ones.
  for (let type in compTitles.new) {
    for (let title of compTitles.new[type]) {
      const id = title.toLocaleLowerCase().replace(" ", "_").split("/")[0];
      if (!game.packs.has(`world.${id}`)) {
        await CompendiumCollection.createCompendium({
          name: id,
          label: title,
          path: `packs/${id}.db`,
          private: false,
          type: type,
          system: "lancer",
          package: "world",
        });
      }
    }
  }

  await game.settings.set(game.system.id, LANCER.setting_core_data, "0.0.0");
  await game.settings.set(game.system.id, LANCER.setting_lcps, new LCPIndex(null));
};

/**
 * Apply migration rules to all Entities within a single Compendium pack
 * @param pack
 * @param {boolean} minor Perform minor version update, defaults to false
 * @return {Promise}
 */
export const migrateCompendium = async function (pack: Compendium, minor: boolean = true) {
  const wasLocked = pack.locked;
  await pack.configure({ locked: false });
  if (pack.locked) return ui.notifications.error(`Could not migrate ${pack.collection} as it is locked.`);
  const docName = pack.documentName;
  // For 0.9 -> 1.0, only do actors and scenes.
  if (!["Actor", "Scene"].includes(docName)) return;

  // Iterate over compendium entries - applying fine-tuned migration functions
  for (let entry of pack.index) {
    let doc = await pack.getDocument(entry._id);
    try {
      let updateData = {};
      if (docName === "Item") updateData = await migrateItemData(doc as Item);
      else if (docName === "Actor") updateData = await migrateActorData(doc as Actor, minor);
      else if (docName === "Scene") updateData = await migrateSceneData(doc.data, minor);
      if (!isObjectEmpty(updateData)) {
        await doc.update(updateData);
        console.debug(`Migrated ${docName} document ${doc.name} in Compendium ${pack.collection}`);
      }
    } catch (err) {
      console.error(err);
    }
  }
  await pack.configure({ locked: wasLocked });
  console.log(`Migrated all ${docName} entities from Compendium ${pack.collection}`);
};

/* -------------------------------------------- */
/*  Document Type Migration Helpers               */
/* -------------------------------------------- */

/**
 * Migrate a single Actor document to incorporate latest data model changes
 * Return an Object of updateData to be applied
 * @param {Actor} actor   The actor to update
 * @param {boolean} minor Perform minor version update, defaults to false
 * @return {Object}       The updateData to apply
 */
export const migrateActorData = async function (actor: Actor, minor: boolean = false) {
  let origData: any = actor.data;
  const updateData: LancerNpcData = { _id: origData._id, data: {} };

  // Insert code to migrate actor data model here
  // Minor migration from version 0.9.x to 1.0 - remove `current_` from data field names
  if (minor) {
    const prefix = "current_";
    for (let key of Object.keys(origData.data)) {
      if (key.startsWith(prefix)) {
        let new_key = key.substr(prefix.length);
        updateData.data[new_key] = origData.data[key];
        updateData[`data.-=${key}`] = null;
      }
    }
    // Make sure we don't have any leftover derived data from old versions.
    updateData[`data.-=derived`] = null;
    console.log(updateData);
    return updateData;
  }

  // Major migration from 0.1.20 to 1.0, only do NPCs and Deployables. Mechs didn't exist,
  // and pilots need the GM to import LCPs first.
  if (actor.data.type === EntryType.NPC) {
    updateData.data.tier = origData.data.tier_num;
    // These are conditional because unlinked token actors only define the properties which have changed
    if (origData.data.mech?.heat) updateData.data.heat = origData.data.mech.heat.value;
    if (origData.data.mech?.hp) updateData.data.hp = origData.data.mech.hp.value;
    if (origData.data.mech?.stress) updateData.data.stress = origData.data.mech.stress.value;
    if (origData.data.mech?.structure) updateData.data.structure = origData.data.mech.structure.value;

    updateData["data.-=mech"] = null;
    updateData["data.-=npc_size"] = null;
    updateData["data.-=activations"] = null;
  } else if (actor.data.type === EntryType.DEPLOYABLE) {
    updateData.data.detail = origData.data.effect;
    // These are conditional because unlinked token actors only define the properties which have changed
    if (origData.data.mech?.heat) {
      updateData.data.heat = origData.data.heat.value;
      updateData.data.heatcap = origData.data.heat.max;
    }
    if (origData.data.mech?.hp) {
      updateData.data.hp = origData.data.hp.value;
      updateData.data.max_hp = origData.data.hp.max;
    }

    updateData["data.-=description"] = null;
  } else {
    return {};
  }

  // Migrate Owned Items
  if (!actor.items) return updateData;
  let hasItemUpdates = false;
  const items = [];
  const ai = actor.items.contents as Array<LancerItem>;
  for (let i = 0; i < ai.length; i++) {
    const item = ai[i];
    // Migrate the Owned Item
    let itemUpdate = await migrateItemData(item);
    // Add it to the array of items to update
    if (!isObjectEmpty(itemUpdate)) {
      hasItemUpdates = true;
      items.push(itemUpdate);
    }
  }
  if (hasItemUpdates) {
    await actor.updateEmbeddedDocuments("Item", items, { parent: actor });
  }

  // Remove deprecated fields
  _migrateRemoveDeprecated(actor, updateData);

  return updateData;
};

/* -------------------------------------------- */

/**
 * Scrub an Actor's system data, removing all keys which are not explicitly defined in the system template
 * @param {ActorData} actorData    The data object for an Actor
 * @return {ActorData}             The scrubbed Actor data
 */
function cleanActorData(actorData: ActorData) {
  // Scrub system data
  const model = game.system.model.Actor[actorData.type];
  actorData.data = filterObject(actorData.data, model);

  // Scrub system flags
  const allowedFlags = CONFIG.LANCER.allowedActorFlags.reduce((obj, f) => {
    obj[f] = null;
    return obj;
  }, {});
  if (actorData.flags.lancer) {
    actorData.flags.lancer = filterObject(actorData.flags.lancer, allowedFlags);
  }

  // Return the scrubbed data
  return actorData;
}

/* -------------------------------------------- */

/**
 * Migrate a single Item document to incorporate latest data model changes
 * @param item
 */
export const migrateItemData = async function (item: LancerItem<NpcClass | NpcTemplate | NpcFeature>) {
  const origData = item.data;
  const updateData = { _id: origData._id, data: {} };

  function ids_to_rr(id_arr: string[]): RegRef<EntryType.NPC_FEATURE>[] {
    return id_arr.map(feat_id => ({
      id: "",
      fallback_lid: feat_id,
      type: EntryType.NPC_FEATURE,
      reg_name: "comp_core",
    }));
  }

  switch (origData.type) {
    case EntryType.NPC_CLASS:
      // id -> lid
      updateData.data.lid = origData.data.id;
      // base_features convert from array of CC IDs to array of RegRefs.
      updateData.data.base_features = ids_to_rr(origData.data.base_features);
      // optional_features convert from array of CC IDs to array of RegRefs.
      updateData.data.optional_features = ids_to_rr(origData.data.optional_features);
      // stats -> base_stats
      //      evasion -> evade
      //      sensor_range -> sensor
      //      delete stress, structure
      updateData.data.base_stats = origData.data.stats;
      updateData.data.base_stats.evade = origData.data.stats.evasion;
      updateData.data.base_stats.sensor = origData.data.stats.sensor_range;
      updateData["data.base_stats.-=evasion"] = null;
      updateData["data.base_stats.-=sensor_range"] = null;
      updateData["data.base_stats.-=structure"] = null;
      updateData["data.base_stats.-=stress"] = null;
      // mech_type -> role
      updateData.data.role = origData.data.mech_type;
      // add power, type
      updateData.data.power = 100;
      // delete id, flavor_name, flavor_description, description, mech_type, item_type, note
      updateData["data.-=id"] = null;
      updateData["data.-=flavor_name"] = null;
      updateData["data.-=flavor_description"] = null;
      updateData["data.-=description"] = null;
      updateData["data.-=mech_type"] = null;
      updateData["data.-=item_type"] = null;
      updateData["data.-=note"] = null;

      break;
    case EntryType.NPC_TEMPLATE:
      // id -> lid
      updateData.data.lid = origData.data.id;
      // base_features convert from array of CC IDs to array of RegRefs.
      updateData.data.base_features = ids_to_rr(origData.data.base_features);
      // optional_features convert from array of CC IDs to array of RegRefs.
      updateData.data.optional_features = ids_to_rr(origData.data.optional_features);
      // add power
      updateData.data.power = 20;

      // delete flavor_name, flavor_description, item_type, note
      updateData["data.-=flavor_name"] = null;
      updateData["data.-=flavor_description"] = null;
      updateData["data.-=item_type"] = null;
      updateData["data.-=note"] = null;
      break;
    case EntryType.NPC_FEATURE:
      updateData.data.lid = origData.data.id ? origData.data.id : "";
      updateData.data.loaded = true;
      updateData.data.type = origData.data.feature_type;
      updateData.data.origin = {
        name: origData.data.origin_name,
        base: origData.data.origin_base,
        type: origData.data.origin_type,
      };
      updateData.data.tier_override = 0;
      // Make sure accuracy and attack bonus are not strings
      updateData.data.accuracy = [];
      for (let acc of origData.data.accuracy) {
        if (typeof acc === "string") {
          if (acc === "") updateData.data.accuracy.push(0);
          else updateData.data.accuracy.push(parseInt(acc));
        } else updateData.data.accuracy.push(acc);
      }
      updateData.data.attack_bonus = [];
      for (let atk of origData.data.attack_bonus) {
        if (typeof atk === "string") {
          if (atk === "") updateData.data.attack_bonus.push(0);
          else updateData.data.attack_bonus.push(parseInt(atk));
        } else updateData.data.attack_bonus.push(atk);
      }
      // Transform damage. Old format is array of damage types, each type has an Array[3] of vals.
      // New format is an Array[3] of damage types per tier. Each damage type follows normal {type, val} spec.
      updateData.data.damage = [[], [], []];
      origData.data.damage.forEach((oldDamage: { type: str; val: [str | int] }) => {
        if (oldDamage.val && Array.isArray(oldDamage.val)) {
          for (let i = 0; i < Math.min(3, oldDamage.val.length); i++) {
            updateData.data.damage[i].push({ type: oldDamage.type, val: oldDamage.val[i] });
          }
        }
      });
      // Migrate & relink tags;
      updateData.data.tags = [];
      if (origData.data.tags) {
        let origTags = origData.data.tags;
        if (!Array.isArray(origTags)) {
          origTags = arrayify_object(origTags);
        }
        origTags.forEach(tag => {
          // If the tag doesn't have an id, skip it.
          // This could be made smarter to search the tag compendium tags by name - has to account for {VAL}.
          if (!tag.id) return;
          let newTagRef: RegRef<EntryType.TAG> = {
            id: "",
            fallback_lid: tag.id,
            reg_name: "comp_core",
            type: EntryType.TAG,
          };
          let newTag: RegTagData = {
            tag: newTagRef,
            val: tag.val,
          };
          updateData.data.tags.push(newTag);
        });
      }

      // Remove deprecated fields
      updateData["data.-=id"] = null;
      updateData["data.-=feature_type"] = null;
      updateData["data.-=max_uses"] = null;
      // Keep these ones if they have anything in them, just in case.
      if (origData.data.flavor_description === "") {
        updateData["data.-=flavor_description"] = null;
      }
      if (origData.data.flavor_name === "") {
        updateData["data.-=flavor_name"] = null;
      }
      if (origData.data.note === "") {
        updateData["data.-=note"] = null;
      }
      updateData["data.-=origin_name"] = null;
      updateData["data.-=origin_base"] = null;
      updateData["data.-=origin_type"] = null;

      break;
    default:
      return {};
  }

  // Remove deprecated fields
  _migrateRemoveDeprecated(item, updateData);

  // Return the migrated update data
  return updateData;
};

/* -------------------------------------------- */

/**
 * Migrate a single Scene document to incorporate changes to the data model of it's actor data overrides
 * Return an Object of updateData to be applied
 * @param {Object} scene  The Scene data to Update
 * @param {boolean} minor Apply minor version update, defaults to false
 * @return {Object}       The updateData to apply
 */
export const migrateSceneData = async function (scene, minor: boolean = false) {
  console.log(`Migrating scene ${scene.name}`);
  if (!scene.tokens) return;
  const tokens = scene.tokens.contents as Array<LancerTokenDocument>;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    // Migrate unlinked actors
    if (!token.isLinked) {
      let token_actor = token.actor;
      console.log(`Migrating unlinked token actor ${token_actor.name}`);
      let updateData = await migrateActorData(token_actor, minor);
      if (updateData && !isObjectEmpty(updateData)) {
        await token_actor.update(updateData);
      }
    }

    // Migrate tokens themselves
    await migrateTokenData(token);
  }
};

// Migrates a TokenDocument (not the actor! just the token!)
export const migrateTokenData = async (token: LancerTokenDocument) => {
  let updateData = {};

  // Returns a corrected bar attribute or, if one could not be deduced, just hp
  const fix_bar_attribute = (attr_name: string) => {
    attr_name = attr_name || ""; // sanity
    if (attr_name.includes("heat")) {
      return "derived.heat";
    } else if (attr_name.includes("hp")) {
      return "derived.hp";
    } else if (attr_name.includes("shield")) {
      return "derived.overshield";
    } else if (attr_name.includes("burn")) {
      return "burn";
    } else if (attr_name.includes("struct")) {
      return "derived.structure";
    } else if (attr_name.includes("stress")) {
      return "derived.stress";
    } else if (attr_name.includes("rep")) {
      return "derived.repairs";
    } else {
      return "derived.hp"; // a safe alternative
    }
  };

  // Fix the standard bars individually
  if (token.data.bar1) {
    updateData["bar1"] = {
      attribute: fix_bar_attribute(token.data.bar1.attribute),
    };
  }
  if (token.data.bar2) {
    updateData["bar2"] = {
      attribute: fix_bar_attribute(token.data.bar2.attribute),
    };
  }

  // Fix bar brawlers
  if (token.data.flags?.barbrawl?.resourceBars) {
    let bb_data = token.data.flags.barbrawl;
    let bb_update_data = {};
    for (let bar_key of Object.keys(bb_data.resourceBars)) {
      bb_update_data[bar_key] = {
        attribute: fix_bar_attribute(bb_data[`${bar_key}.attribute`]),
      };
    }
    updateData["flags.barbrawl.resourceBars"] = bb_update_data;
  }

  // Apply update
  await token.update(updateData);
};

// If the scene data itself needs to be migrated, make the changes and return the migrated data here.

/* -------------------------------------------- */

/**
 * A general migration to remove all fields from the data model which are flagged with a _deprecated tag
 * @private
 */
const _migrateRemoveDeprecated = function (doc, updateData) {
  const flat = flattenObject(doc.data);

  // Identify objects to deprecate
  const toDeprecate = Object.entries(flat)
    .filter(e => e[0].endsWith("_deprecated") && e[1] === true)
    .map(e => {
      let parent = e[0].split(".");
      parent.pop();
      return parent.join(".");
    });

  // Remove them
  for (let k of toDeprecate) {
    let parts = k.split(".");
    parts[parts.length - 1] = "-=" + parts[parts.length - 1];
    updateData[`data.${parts.join(".")}`] = null;
  }
};
