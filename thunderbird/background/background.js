import init, { ArcusKeypair, Arcus } from "/arcus.js";
import { provideComposeDetailsToWindow, ArcusPort } from './composeAction.js';
import { getWinTab, getAllStorageItems, getLocalKeys } from '/utils.js';

window.addEventListener("load", initiate);


const stG = browser.storage.local.get;

const cmds = {
    DECRYPT: "decrypt",
    ENCRYPT: "encrypt",
    GENERATE: "generate",
    PUB_FROM_SECRET: "pub_from_secret"
};

const ciphertextBegin = "-----BEGIN AGE ENCRYPTED FILE-----";
const ciphertextEnd = "-----END AGE ENCRYPTED FILE-----";

var ports;  // init in initiate

messenger.messageDisplayScripts.register({
	js: [{
		file: "/displayscript.js"
	}]
});

async function handleBrowserAction(tab, info) {
    messenger.tabs.create({
        url: "/tab/tab.html",
        active: true
    });
}


async function handleMessageDisplayed(tab, message) {
    let mid = message.id;
    let parts = await messenger.messages.getFull(mid);

    if (parts.contentType == "message/rfc822") {
        if (parts.parts.length == 1 && parts.parts[0].contentType == "multipart/alternative") {
            let ps = parts.parts[0].parts;

            let hasPlain = false;
            let plaintextBody = null;
            let htmlBody = null;
            let hasAgeBlock = false;

            for (let i = 0; i < ps.length; i++) {
                let body = ps[i].body;

                if (body.includes(ciphertextBegin) || body.includes(ciphertextEnd)) {
                    hasAgeBlock = true;
                } else {
                    // No cipher block in this part
                    continue
                }

                switch (ps[i].contentType) {
                    case "text/plain":
                        hasPlain = true;
                        plaintextBody = body;
                        continue

                    case "text/html":
                        // its complicated...
                        htmlBody = body;
                        continue
                }
            }

            let decryptedText;

            if (hasPlain && hasAgeBlock && plaintextBody !== null) {
                // Simply decrypt the plain text body
                decryptedText = await decryptPlaintextMessagePart(plaintextBody);
            } else if (!hasPlain && hasAgeBlock && htmlBody !== null) {
                // More complicated.. HTML part needs to be parsed and then searched
                let html = await parseCipherHTML(htmlBody);
            } else {
                console.log("There is neither a plain text nor an HTML body to parse");
            }
        }
    }
}

async function composeActionOnClicked(tab, info) {
    // Does not work, because it will fire the "onClick" event, and creates a loop
    // messenger.composeAction.openPopup();

    // let creation = await messenger.tabs.create({ url: "compose_popup/compose_popup.html" });

    let cd = await messenger.compose.getComposeDetails(tab.id);

    if (!cd.isPlainText) {
        console.log("Only plaintext message composition is supported at the moment");
        return;
    }

    let plaintext = cd.plainTextBody;
    let to = cd.to;  // array

//    let s = await messenger.tabs.executeScript(tab.id, {
//        code: `let ok = confirm("Are you ready to encrypt?"); if (ok) { } else { }`
//    });

    let currWin = await messenger.windows.getCurrent();
    let multiplier = 0.5;

    let win = await messenger.windows.create({
        url: "/compose_popup/compose_popup.html#windowid="+tab.windowId+"|tabid="+tab.id,
        type: "popup",
        height: Math.floor(currWin.height * multiplier),
        width: Math.floor(currWin.width * multiplier),
        allowScriptsToClose: true,
    });
}

/// Called by the popup window when clicked on the compose action button
function handleComposePopupPort(port) {
    let popup_win_tabid = port.sender.tab.id;

    // Get hash from full url
    let winTab = getWinTab(port.sender.url.split("#")[1]);

    let newAP = new ArcusPort(port, winTab.composeWindowId, winTab.composeTabId);

    newAP.port.onDisconnect.addListener((port) => {
        //~ console.log("Disconnect from port: " + port.name + ". Length ports: " + ports.length);
        ports = ports.filter(item => item.port.name !== port.name);
        //~ console.log("Removed port from array, length: " + ports.length);
    });

    ports.push(newAP);

    provideComposeDetailsToWindow(newAP);

    newAP.port.onMessage.addListener(async (m) => {

        switch (m.cmd) {
            case cmds.ENCRYPT:
                let compDetails = await messenger.compose.getComposeDetails(newAP.tabId);

                let plaintext = compDetails.plainTextBody;
                let recipients = m.recipient_keys;

                let ciphertext = window.arcus.encrypt_text_multi(plaintext, recipients);

                await messenger.compose.setComposeDetails(newAP.tabId, {
                    plainTextBody: ciphertext
                });
        }
    });
}


function initiate() {
    // https://stackoverflow.com/questions/61986932/how-to-pass-a-string-from-js-to-wasm-generated-through-rust-using-wasm-bindgen-w
    // https://wasmbyexample.dev/examples/passing-high-level-data-types-with-wasm-bindgen/passing-high-level-data-types-with-wasm-bindgen.rust.en-us.html

    const runWasm = async () => {
      const wasm = await init("/arcus_bg.wasm");

      const arcus = new Arcus();
      window.arcus = arcus;
    };
    runWasm();

    // Check setup of local storage
    getAllStorageItems().then((result) => {
		// Local keys
		if (result.userLocalKeys == null) {
			console.log("Set up new empty userLocalKeys array");
			browser.storage.local.set({
				userLocalKeys: []
			}).catch(err => console.log(err))
		}
	}).catch(err => console.log(err));

    ports = [];
}

// Source: https://developer.thunderbird.net/add-ons/mailextensions/hello-world-add-on/using-content-scripts
messenger.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message && message.hasOwnProperty("command")) {
        switch (message.command) {
            case cmds.DECRYPT:
				let keys = await getLocalKeys();

                if (keys.length < 1) {
                    console.log("There is no key in storage, but decrypt was called");
                    return null;
                }

				let cleartext = window.arcus.decrypt_text(message.ciphertext, keys[0]);
				return cleartext;

            case cmds.ENCRYPT:
                let ciphertext = window.arcus.encrypt_text(message.plaintext, message.recipient_pubkey);
                return ciphertext;

            case cmds.GENERATE:
                let gk = window.arcus.generate_key();
                return {
                    pubkey: gk.get_pubkey(),
                    secret: gk.get_secret()
                };

            case cmds.PUB_FROM_SECRET:
                let pub = window.arcus.pub_from_secret(message.secret);
                return pub;
        }
    }
});

messenger.browserAction.onClicked.addListener(handleBrowserAction);
messenger.composeAction.onClicked.addListener(composeActionOnClicked);

browser.runtime.onConnect.addListener(async (port) => {
    if (port.name.startsWith("compose_popup_")) {
        handleComposePopupPort(port);
    }
});

