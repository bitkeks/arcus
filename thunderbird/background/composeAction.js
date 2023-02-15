import { getWinTab, getAllStorageItems, getLocalKeys } from '/utils.js';

export class ArcusPort {
    constructor(port, windowId, tabId) {
        this.port = port;
        this.windowId = windowId;
        this.tabId = tabId;
    }
}

export async function provideComposeDetailsToWindow(arcusPort) {
    let compDetails = await messenger.compose.getComposeDetails(arcusPort.tabId);

    // Map of "original contact in To: line" to "age keys"
    let to_mapped = [];

    // Add own key to list of recipients
    let yourself = await getLocalKeys();
    if (yourself.length > 0) {
        // Convert from secret to public, if available
        yourself = [window.arcus.pub_from_secret(yourself[0])];
    }
    to_mapped.push(["Yourself", yourself]);

    for (let contact of compDetails.to) {
        let contact_mailaddress = contact.substr(contact.search("<")+1).replace(">", "");
        let foundContacts = await messenger.contacts.quickSearch(null, contact_mailaddress);  // array

        // Array of collected (found) age keys from addressbook
        let age_keys = [];

        if (foundContacts.length > 0) {
            // There's at least one contact in the addressbook with this email..
            for (let item of foundContacts) {
                if (item.properties.hasOwnProperty("Custom4")) {
                    let age_key = item.properties.Custom4;
                    if (age_key.startsWith("age1")) {
                        age_keys.push(age_key);
                    }
                }
            }
        } else {
            // Contact not found in addressbook
            to_mapped.push([contact, []])
        }

        // Can also be empty array, if no valid age keys are present
        to_mapped.push([contact, age_keys]);
    }

    arcusPort.port.postMessage({
        to: to_mapped,
        plaintext: compDetails.plainTextBody
    });
}

