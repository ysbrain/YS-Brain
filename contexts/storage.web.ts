// Web fallback: no persistence
export async function saveToken(_key: string, _value: string) {
  console.log("SecureStore not available on web — ignoring save");
}

export async function getToken(_key: string) {
  console.log("SecureStore not available on web — returning null");
  return null;
}

export async function deleteToken(_key: string) {
  console.log("SecureStore not available on web — ignoring delete");
}
