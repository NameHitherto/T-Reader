use futures_util::future::AbortHandle;
use std::{collections::HashMap, sync::Mutex};

#[derive(Default)]
pub struct AiStreamState {
    pub abort_handles: Mutex<HashMap<String, AbortHandle>>,
}
