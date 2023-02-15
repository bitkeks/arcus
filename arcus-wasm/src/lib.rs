use std::error::Error;
use std::io::{Read, Write};
use std::iter;
use std::str::FromStr;
use std::string::FromUtf8Error;
use age;
use age::armor::{ArmoredReader, ArmoredWriter};
use age::armor::Format::AsciiArmor;
use age::{DecryptError, Decryptor};
use age::secrecy::{ExposeSecret, Secret, SecretString};
use age::x25519::{Identity, Recipient};
use chrono;
use js_sys::{Array, JsString};
use wasm_bindgen::prelude::*;
use wasm_streams::{readable::ReadableStream, writable::WritableStream};
use web_sys::{Blob, BlobPropertyBag};

mod utils;
mod encrypt;

#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    // Note that this is using the `log` function imported above during
    // `bare_bones`
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[wasm_bindgen]
pub struct ArcusKeypair {
    pubkey: Recipient,
    secret: SecretString
}

#[wasm_bindgen]
impl ArcusKeypair {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        let kp = Identity::generate();
        Self {
            pubkey: kp.to_public(),
            secret: kp.to_string()
        }
    }

    pub fn get_pubkey(&self) -> String {
        self.pubkey.to_string().clone()
    }

    pub fn get_secret(&self) -> String {
        self.secret.expose_secret().to_string().clone()
    }
}

#[wasm_bindgen]
pub struct Arcus {}

#[wasm_bindgen]
impl Arcus {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {}
    }

    pub fn encrypt_text(&self, cleartext: String, recipient_pubkey: String) -> String {
        utils::set_panic_hook();

        let new_array = Array::new();
        new_array.push(&JsString::from(recipient_pubkey));

        self.encrypt_text_multi(cleartext, new_array)
    }

    pub fn encrypt_text_multi(&self, cleartext: String, recipient_pubkeys: Array) -> String {
        utils::set_panic_hook();

        let mut recs: Vec<Box<dyn age::Recipient + Send + 'static>> = Vec::new();

        for recipient_pubkey in recipient_pubkeys.iter() {
            if !recipient_pubkey.is_string() {
                console_log!("{:?} is not a string", recipient_pubkey);
                continue;
            }

            let pubkey = recipient_pubkey.as_string().unwrap();
            let rpk_str = pubkey.as_str();

            let re = match age::x25519::Recipient::from_str(rpk_str) {
                Ok(recipient) => recipient,
                Err(e) => return "invalid recipient string".to_string()
            };

            recs.push(Box::new(re));
        }

        let encrypted = {
            let encryptor = age::Encryptor::with_recipients(recs)
                .expect("we provided a recipient");

            let mut enc_vec = vec![];
            let mut writer = encryptor.wrap_output(
                ArmoredWriter::wrap_output(&mut enc_vec, AsciiArmor)
                    .expect("armored wrap_output failed"))
                .expect("wrap_output failed");

            writer.write_all(cleartext.as_bytes())
                .expect("write_all failed");

            match writer.finish() {
                Ok(aw) => {
                    aw.finish().expect("armored writer could not finish");
                },
                Err(e) => {
                    console_log!("{:?}", e);
                }
            };

            enc_vec
        };

        let res = match String::from_utf8(encrypted) {
            Ok(ct) => ct,
            Err(e) => e.to_string()
        };

        res
    }

    pub fn decrypt_text(&self, ciphertext: String, own_secretkey: String) -> String {
        utils::set_panic_hook();

        let secret_id = match age::x25519::Identity::from_str(own_secretkey.as_str()) {
            Ok(identity) => identity,
            Err(e) => {
                console_log!("{:?}", e);
                return "error parsing secret key".to_string()
            }
        };

        let decrypted = {
            let decryptor = match age::Decryptor::new(ArmoredReader::new(ciphertext.as_bytes())).expect("Error") {
                age::Decryptor::Recipients(d) => d,
                _ => unreachable!(),
            };

            let key = age::x25519::Identity::from_str(own_secretkey.as_str()).unwrap();

            let mut dec_vec = vec![];
            let mut reader = decryptor
                .decrypt(iter::once(&key as &dyn age::Identity))
                .expect("decryptor.decrypt failed");
            reader.read_to_end(&mut dec_vec).expect("read_to_end failed");
            dec_vec
        };

        let res = match String::from_utf8(decrypted) {
            Ok(ct) => ct,
            Err(e) => e.to_string()
        };

        res
    }

    pub fn generate_key(&self) -> ArcusKeypair {
        ArcusKeypair::new()
    }

    pub fn pub_from_secret(&self, secret_key: String) -> String {
        let id = match age::x25519::Identity::from_str(secret_key.as_str()) {
            Ok(parsed_id) => parsed_id,
            Err(e) => return e.to_string()
        };

        id.to_public().to_string()
    }
}


#[wasm_bindgen]
pub struct X25519Identity {
    identity: age::x25519::Identity,
    created: chrono::DateTime<chrono::Local>,
}

#[wasm_bindgen]
impl X25519Identity {
    /// Generates a new age identity.
    pub fn generate() -> Self {
        // This is an entrance from JS to our WASM APIs; perform one-time setup steps.
        utils::set_panic_hook();

        X25519Identity {
            identity: age::x25519::Identity::generate(),
            created: chrono::Local::now(),
        }
    }

    /// Writes this identity to a blob that can be saved as a file.
    pub fn write(&self) -> Result<Blob, JsValue> {
        let output = format!(
            "# created: {}\n# recipient: {}\n{}",
            self.created
                .to_rfc3339_opts(chrono::SecondsFormat::Secs, true),
            self.identity.to_public(),
            self.identity.to_string().expose_secret()
        );

        Blob::new_with_u8_array_sequence_and_options(
            &Array::of1(&JsValue::from_str(&output)).into(),
            &BlobPropertyBag::new().type_("text/plain;charset=utf-8"),
        )
    }

    /// Returns the recipient corresponding to this identity.
    pub fn recipient(&self) -> String {
        self.identity.to_public().to_string()
    }
}

