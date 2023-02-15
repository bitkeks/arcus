# Arcus

This project contains the source code of the Thunderbird add-on Arcus.

It's a Rust-based encryption and decryption tool integrated into the email client, powered by Rust, https://github.com/str4d/rage and WebAssembly.

See: [addons.thunderbird.net/en-GB/thunderbird/addon/arcus/](https://addons.thunderbird.net/en-GB/thunderbird/addon/arcus/)


## Thunderbird

What you can do:

* Set your secret key and automatically decrypt emails
* Generate a new key pair and download it to a file
* Encrypt plain text in emails for a list of recipients. The addon reads the "To"-field and tries to fetch public keys for these contacts (stored in the "Custom4" field in the address book).


### Permissions
This addon uses a long list of permissions, because each is needed for small things. Of course, nothing unexpected is done with your mails or account!

* compose: Replace plain text with encrypted text
* storage: Store your own secret key for automatic decryption
* messagesRead: Read incoming mails and decrypt existing age blocks
* messagesModify: Replace the cipher text with plaintext (only changed in display, the original email itself is never modified)
* tabs: Open and query tabs and their content
* addressBooks: Fetch a public age key from your contact, if stored in field "Custom4"
* accountsRead: Read info about the current account
* browserSettings: Compatibility with some functions


## License

Copyright 2023 Dominik Pataky

Licensed under the MIT license.
