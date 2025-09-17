// src/lib/pexipApi.js
export const pexipApiGet = async (path, token) => {
  const response = await fetch(`/api/client/v2${path}`, {
    method: "GET",
    headers: token ? { token } : {},
  });
  if (!response.ok) {
    const t = await response.text();
    throw new Error(`GET ${path} failed (${response.status}): ${t}`);
  }
  return response.json();
};

export const pexipApiPost = async (path, body = undefined, token) => {
  const headers = token ? { token } : {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`/api/client/v2${path}`, {
    method: "POST",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`POST ${path} failed (${res.status}): ${t}`);
  }
  // try parse json else return {}
  try {
    return await res.json();
  } catch {
    return {};
  }
};
