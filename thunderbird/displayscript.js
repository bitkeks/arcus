const displayTypes = {
    PLAIN: "plain",
    SIMPLE: "simple",
    HTML: "html"
};

const cmds = {
    DECRYPT: "decrypt",
    ENCRYPT: "encrypt",
    GENERATE: "generate",
    PUB_FROM_SECRET: "pub_from_secret"
};

const ciphertextBegin = "-----BEGIN AGE ENCRYPTED FILE-----";
const ciphertextEnd = "-----END AGE ENCRYPTED FILE-----";


// As we cannot read the setting for "message display format" (plain, simple HTML, full HTML)
// we need to guess the currently used display format from the document object
function detectDisplayStyle(html) {
    let cn = html.body.childNodes;
    let isPlaintext = false;
    let isFullHTML = false;

    for (node of cn) {
        switch (node.nodeName) {
            // divs are for text blocks
            case "DIV":
                for (cl of node.classList) {
                    if (cl == "moz-text-html") {
                        isPlaintext = false;
                    } else if (cl == "moz-text-flowed" || cl == "moz-text-plain") {
                        isPlaintext = true;
                    }
                }

            // meta is injected in full HTML email displays
            case "META":
                if (node.hasAttribute("http-equiv") &&
                    node.httpEquiv == "content-type" &&
                    node.hasAttribute("content") &&
                    node.content.startsWith("text/html")) {
                        isFullHTML = true;
                    }

        }
    }

    if (isPlaintext && !isFullHTML) return displayTypes.PLAIN;
    if (!isPlaintext && !isFullHTML) return displayTypes.SIMPLE;
    if (!isPlaintext && isFullHTML) return displayTypes.HTML;

    return null;
}


async function run_displayscript() {
    let style = detectDisplayStyle(document);

    // This looks like the most promising solution.
    // We should not handle mixed content from HTML emails. Only "whole email is age".
    // For now, only PLAIN message display is supported.

    if (!(style == displayTypes.PLAIN) && document.body.innerText.includes(ciphertextBegin)) {
        console.log("There's an age block to decrypt, but the display style is not PLAIN. Please switch to plain display mode.");

        let el = document.createElement("div");
        el.style = "border: 1px solid black; background: #76a4e1; padding: 1em;";
        el.innerText = "This e-mail contains an encrypted age text block, but the display style is not PLAIN. Please switch to plain display mode to decrypt.";
        document.body.insertBefore(el, document.body.childNodes[0]);

        return;
    }

    // The following cases cover both incoming mail and draft mails
    let target_elem;

    // First, check for pre blocks (in draft mails)
    let pre_elems = document.body.getElementsByTagName("pre");
    if (pre_elems.length > 0) {
        target_elem = pre_elems[0];
    } else {
        // Second, fall back to div.moz-text-flowed as used in incoming mails
        console.log("No <pre> found, trying div.moz-text-flowed");
        let flowed_elems = document.body.getElementsByClassName("moz-text-flowed");
        if (flowed_elems.length == 1)  {
            target_elem = flowed_elems[0];
        } else {
            console.log("Error with flowed_elems, length: " + flowed_elems.length);
        }
    }

    // Double check that everything is working
    if (target_elem === null) {
        console.log("target_elem is null, returning");
        return;
    }

    // Extract the text
    let ct = target_elem.innerText;

    if (!ct.includes(ciphertextBegin) || !ct.includes(ciphertextEnd)) {
        // Not encrypted
        return;
    }

    // Trim spaces and newlines at the beginning and end of the ciphertext
    ct = ct.trim();

    // And parse lines..
    let before_lines = [];
    let after_lines = [];
    let cipher_lines = [];
    let cipher_lines_active = false;
    let is_before = true;

    for (line of ct.split("\n")) {
        if (line === "-----END AGE ENCRYPTED FILE-----") {
            cipher_lines_active = false;
            cipher_lines.push(line);
            is_before = false;
            continue;
        }

        if (line === "-----BEGIN AGE ENCRYPTED FILE-----") {
            cipher_lines_active = true;
            cipher_lines.push(line);
            continue;
        }

        if (cipher_lines_active) {
            cipher_lines.push(line);
        } else if (is_before) {
            before_lines.push(line);
        } else {
            after_lines.push(line);
        }
    }

    // Parsing finished, only the cipher_lines will now be sent to be decrypted
    messenger.runtime.sendMessage({
        command: cmds.DECRYPT,
        ciphertext: cipher_lines.join("\n")
    }).then(cleartext => {
        if (cleartext === null) {
            // Error - no key present

            let el = document.createElement("div");
            el.style = "border: 1px solid black; background: #76a4e1; padding: 1em;";
            el.innerText = "There's an age encrypted text block here, but no decryption key (secret key) available. Did you store it in Thunderbird? Use the \"Arcus\" button on the top left to store your key.";
            document.body.insertBefore(el, document.body.childNodes[0]);

            //~ target_elem.innerText = "There's an age encrypted text block here, but no decryption key (secret key) available. Did you store it in Thunderbird?";
            return;
        }

        target_elem.innerText = before_lines.join("\n") +
            "\n~~~ decrypted block start ~~~\n" +
            cleartext +
            "\n~~~ decrypted block end ~~~\n" +
            after_lines.join("\n");
    }).catch(err => console.log(err));

    return;
}


(async() => {
  await run_displayscript()
})()


