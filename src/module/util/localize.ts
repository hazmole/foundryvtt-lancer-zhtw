function localizeStructureTableTitle(key: string): string {
  return safeLocalize(`TABLES.structure.title.${fmt(key)}`, key);
}
function localizeStructureTableDesc(key: string): string {
  return safeLocalize(`TABLES.structure.effect.${fmt(key)}`, key);
}

function localizeOverheatTableTitle(key: string): string {
  return safeLocalize(`TABLES.overheat.title.${fmt(key)}`, key);
}
function localizeOverheatTableDesc(key: string): string {
  return safeLocalize(`TABLES.overheat.effect.${fmt(key)}`, key);
}

function safeLocalize(i18nPath: string, defaultVal: string): string {
  try {
    let retVal = game.i18n.localize(i18nPath);
    if (retVal === i18nPath || retVal === "") {
      return defaultVal;
    }
    return retVal;
  } catch (e) {
    console.error(e);
    return "--";
  }
}
function fmt(o: string): string {
  return o.replace(/ /g, "_");
}

export const localizer = {
  structTableTitle: localizeStructureTableTitle,
  structTableDesc: localizeStructureTableDesc,
  overheatTableTitle: localizeOverheatTableTitle,
  overheatTableDesc: localizeOverheatTableDesc,
};
