import { getWinTab, getLocalKeys } from '/utils.js';

const msgType = {
    ERROR: "#ff8f8f",
    SUCCESS: "lightgreen",
    INFO: "lightblue"
};

var port;

function messageboxUpdate(msg, msgtype) {
    let mb = document.querySelector("#messagebox");
    mb.innerText = msg;
    mb.style.transition = '0';
    mb.style.background = msgtype;

    setTimeout(() => {
        mb.style.transition = '1s';
        mb.style.background = 'white';
    }, 1000);
}

function ready(e) {
    let ids = getWinTab(document.location.hash);
    port = browser.runtime.connect(null, { name: "compose_popup_"+ids.composeWindowId+"_"+ids.composeTabId });

    port.onMessage.addListener((m) => {
        if (m.hasOwnProperty("to") && m.hasOwnProperty("plaintext")) {
            let not_found_contacts = [];

            // List all found receivers (searched from the To-line)
            let rtab = document.querySelector("#receiver_table");

            for (let recv of m.to) {
                let name = recv[0];
                let keys = recv[1];  // array

                if (keys.length == 0) {
                    not_found_contacts.push(name);
                    continue;
                }

                for (let key of keys) {
                    let new_row = document.createElement("tr");
                    let new_name = document.createElement("td");
                    let new_key = document.createElement("td");

                    new_name.innerText = name;
                    new_key.innerText = key;

                    new_row.appendChild(new_name);
                    new_row.appendChild(new_key);

                    rtab.appendChild(new_row);
                }
            }

            if (not_found_contacts.length > 0) {
                let not_found_list = document.querySelector("ul#not_found_contacts");

                document.querySelector("div#not_found_contacts_div").style.display = "";

                for (let c of not_found_contacts) {
                    let new_li = document.createElement("li");
                    new_li.innerText = c;
                    not_found_list.appendChild(new_li);
                }
            }
        }
    });
}

function closeButton(e) {
    e.preventDefault();
    window.close();
}

function encryptButton(e) {
    e.preventDefault();
    let recv_table = document.querySelector("#receiver_table");

    let keys = [];
    for (let i = 1; i < recv_table.rows.length; i++) {
        let key = recv_table.rows[i].children[1].innerText;
        keys.push(key);
    }

    port.postMessage({ cmd: "encrypt", recipient_keys: keys });
}

function addRecvButton(e) {
    e.preventDefault();
    let adding_name_elem = document.querySelector("#add_recv_name");
    let adding_key_elem = document.querySelector("#add_recv_key");

    if (adding_key_elem.value.length != 62 || !adding_key_elem.value.startsWith("age1")) {
        messageboxUpdate("Incorrect age key format for new recipient!", msgType.ERROR);
        return;
    }

    // Add row to existing table
    let rtab = document.querySelector("#receiver_table");
    let new_row = document.createElement("tr");
    let new_name = document.createElement("td");
    let new_key = document.createElement("td");
    new_name.innerText = adding_name_elem.value;
    new_key.innerText = adding_key_elem.value;
    new_key.classList.add("success");
    new_row.appendChild(new_name);
    new_row.appendChild(new_key);
    rtab.appendChild(new_row);

    // And reset
    adding_name_elem.value = "";
    adding_key_elem.value = "";
}

document.addEventListener('DOMContentLoaded', ready);
document.querySelector("#close_button").addEventListener("click", closeButton);
document.querySelector("#encrypt_button").addEventListener("click", encryptButton);
document.querySelector("#add_recv_button").addEventListener("click", addRecvButton);
