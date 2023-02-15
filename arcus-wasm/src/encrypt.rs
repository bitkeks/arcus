use age;
use age::secrecy::{ExposeSecret, SecretString};
use chrono;
use js_sys::Array;
use wasm_bindgen::prelude::*;
use wasm_streams::{readable::ReadableStream, writable::WritableStream};
use web_sys::{Blob, BlobPropertyBag};

use crate::utils;

/// A newtype around an [`age::Encryptor`].
#[wasm_bindgen]
pub struct Encryptor(age::Encryptor);

#[wasm_bindgen]
impl Encryptor {
    /// Returns an `Encryptor` that will create an age file encrypted with a passphrase.
    ///
    /// This API should only be used with a passphrase that was provided by (or generated
    /// for) a human. For programmatic use cases, instead generate a `SecretKey` and then
    /// use `Encryptor::with_recipients`.
    pub fn with_user_passphrase(passphrase: String) -> Encryptor {
        // This is an entrance from JS to our WASM APIs; perform one-time setup steps.
        utils::set_panic_hook();

        Encryptor(age::Encryptor::with_user_passphrase(SecretString::new(
            passphrase,
        )))
    }

    // /// Creates a wrapper around a writer that will encrypt its input.
    // ///
    // /// Returns errors from the underlying writer while writing the header.
    // pub async fn wrap_output(
    //     self,
    //     output: wasm_streams::writable::sys::WritableStream,
    // ) -> Result<wasm_streams::writable::sys::WritableStream, JsValue> {
    //     // Convert from the opaque web_sys::WritableStream Rust type to the fully-functional
    //     // wasm_streams::writable::WritableStream.
    //     let stream = WritableStream::from_raw(output);
    //
    //     let writer = self
    //         .0
    //         .wrap_async_output(stream.into_async_write())
    //         .await
    //         .map_err(|e| JsValue::from(format!("{}", e)))?;
    //
    //     Ok(WritableStream::from_sink(shim::WriteSinker::new(writer)).into_raw())
    // }
}
