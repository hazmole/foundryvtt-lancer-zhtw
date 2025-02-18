function localizeMechWeaponType(source: string): string {
  return easyLocalize(`TYPES.WeaponType.${source}`, source);
}
function localizeMechWeaponSize(source: string): string {
  return easyLocalize(`TYPES.WeaponSize.${source}`, source);
}
function localizeTagName(tagID: string, defaultVale: string): string {
  return easyLocalize(`TYPES.Tag.name.${tagID}`, defaultVale);
}
function localizeTagDescription(tagID: string, defaultVale: string): string {
  return easyLocalize(`TYPES.Tag.description.${tagID}`, defaultVale);
}

function easyLocalize(localizePath: string, defaultVal: string): string {
  let returnVal = game.i18n.localize(localizePath);
  if (returnVal === localizePath || returnVal === "") {
    return defaultVal;
  }
  return returnVal;
}

export const localizer = {
  mechWeaponType: localizeMechWeaponType,
  mechWeaponSize: localizeMechWeaponSize,
  tagName: localizeTagName,
  tagDesc: localizeTagDescription,
};
