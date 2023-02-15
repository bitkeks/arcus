// Compose action port magic
export function getWinTab(hash) {
    if (hash.startsWith("#")) {
        hash = hash.substr(1);
    }
    let _hashparts = hash.split("|");
    let composeWindowId = _hashparts[0].split("=")[1];
    let composeTabId = _hashparts[1].split("=")[1];

    return {
        composeWindowId: parseInt(composeWindowId),
        composeTabId: parseInt(composeTabId)
    };
}


// Storage
const stKey_keys = "userLocalKeys";
export async function getAllStorageItems() {
    return browser.storage.local.get(stKey_keys);
}
export async function getLocalKeys() {
	let keys = await browser.storage.local.get(stKey_keys);
	return keys.userLocalKeys;
}
