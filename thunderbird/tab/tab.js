const mb = document.querySelector("#messagebox");
const gkb = document.querySelector("#generate_key_box");
const cr = document.getElementById("ciphertext_result");

const msgType = {
    ERROR: "#ff8f8f",
    SUCCESS: "lightgreen",
    INFO: "lightblue"
};


function messageboxUpdate(msg, msgtype) {
    mb.innerText = msg;
    mb.style.transition = '0s';
    mb.style.background = msgtype;

    setTimeout(() => {
        mb.style.transition = '1s';
        mb.style.background = 'white';
    }, 1000);
}


function loaded() {
    gkb.style.display = "none";
    cr.style.display = "none";

    mb.innerText = "";
    let ulk = messenger.storage.local.get('userLocalKeys');
    ulk.then(result => {
        if (result.userLocalKeys.length == 0) {
            messageboxUpdate("No secret key present yet.", msgType.INFO);
        } else {
            let secret = result.userLocalKeys[0];
            document.querySelector("#arcuskey > #key").value = secret;
            msg = "Private secret key loaded from storage.";

            messenger.runtime.sendMessage({
                command: "pub_from_secret",
                secret: secret,
            }).then(res => {
                msg = msg + " Public key: " + res;
                messageboxUpdate(msg, msgType.INFO);
            }).catch(err => console.log(err));
        }
    });
}

function saveKey(e) {
    e.preventDefault();
    let key = document.querySelector("#arcuskey > #key").value;

    if (key.length != 74 || !key.startsWith("AGE-SECRET-KEY-")) {
        messageboxUpdate("Something was wrong with your new key. Please check if it is a valid secret key!", msgType.ERROR);
        return;
    }

    let pubkey;

    // First, get public key from secret key
    messenger.runtime.sendMessage({
        command: "pub_from_secret",
        secret: key,
    }).then(res => {
        // Then on success, store the secret key in storage
        pubkey = res;
        messenger.storage.local.set({
            userLocalKeys: [key]
        }).then(res => {
            // And then, on success, print a message
            messageboxUpdate("New key saved successfully. Public key: " + pubkey, msgType.SUCCESS);
        }).catch(err => console.log(err));
    }).catch(err => console.log(err));
}

function generateKey(e) {
    browser.runtime.sendMessage({
        command: "generate"
    }).then(keypair => {
        gkb.style.display = "";

        // Helper function for the download button click event
        function downloadClick(e) {
            let a_dl_elem = window.document.createElement('a');
            a_dl_elem.href = window.URL.createObjectURL(key_blob);
            let d = new Date();
            //~ let timestamp = ""+d.getFullYear()+"-"+d.getMonth().toString().padStart(2, "0")+"-"+d.getDate().toString().padStart(2, "0");
            a_dl_elem.download = "arcus_age_keypair_" + Date.now() + ".txt";
            a_dl_elem.style.display = "none";
            document.body.appendChild(a_dl_elem);
            a_dl_elem.click();
            document.body.removeChild(a_dl_elem);
        }

        let dl_button_elem = document.querySelector("#generate_download_button");
        dl_button_elem.removeEventListener("click", downloadClick);

        document.getElementById("generated_public").textContent = keypair.pubkey;
        document.getElementById("generated_secret").textContent = keypair.secret;

        messageboxUpdate("New keypair generated. Do not forget to store it somewhere safe! Use the 'download' button to save the keypair to a file.", msgType.SUCCESS);

        // Create a txt file in memory and "download" it
        let key_blob = new Blob(["# public key: " + keypair.pubkey + "\n" + keypair.secret], {type: 'text/plain'});
        dl_button_elem.addEventListener("click", downloadClick);
    }).catch(err => console.log(err));
}

async function encrypt(e) {
    e.preventDefault();

    let plaintext = document.querySelector("textarea#plaintext").value;
    let recipient_pubkey = document.querySelector("input#recipient_key").value;

    messenger.runtime.sendMessage({
        command: "encrypt",
        plaintext: plaintext,
        recipient_pubkey: recipient_pubkey
    }).then(ciphertext => {
        console.log(ciphertext);
        cr.style.display = "";

        if (ciphertext == null) {
            messageboxUpdate("There was an error encrypting your text. Is the recipient key correct?", msgType.ERROR);
            cr.textContent = "";
            return;
        }
        cr.textContent = ciphertext;
    }).catch(err => console.log(err));
}

document.addEventListener('DOMContentLoaded', loaded);
document.querySelector("#arcuskey").addEventListener("submit", saveKey);
document.querySelector("#encrypt").addEventListener("submit", encrypt);
document.querySelector("#generate_button").addEventListener("click", generateKey);
