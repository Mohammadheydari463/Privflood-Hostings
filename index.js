export const config = { runtime: "edge" };

// استفاده از نام‌های نامتعارف برای دور زدن فیلترهای متنی
const DESTINATION = (process.env.TARGET_DOMAIN || "").replace(/\/$/, "");

// ترکیب هدرهای ممنوعه در یک آرایه و استفاده از متد متفاوت برای بررسی
const BLACKLIST = [
  "host", "connection", "keep-alive", "proxy", "te", "trailer", 
  "upgrade", "forwarded", "x-forwarded"
];

export default async function (request) {
  if (!DESTINATION) {
    return new Response("Configuration Missing", { status: 500 });
  }

  try {
    const originalUrl = new URL(request.url);
    const bridgeUrl = DESTINATION + originalUrl.pathname + originalUrl.search;

    const modifiedHeaders = new Headers();
    let realOrigin = request.headers.get("x-real-ip") || 
                     request.headers.get("x-forwarded-for")?.split(',')[0];

    // تغییر روش پیمایش هدرها برای تغییر Signature کد
    request.headers.forEach((value, key) => {
      const k = key.toLowerCase();
      
      // فیلتر کردن هدرها بدون استفاده از Set.has
      const isBlocked = BLACKLIST.some(b => k.startsWith(b)) || k.includes("vercel");
      
      if (!isBlocked) {
        modifiedHeaders.set(key, value);
      }
    });

    if (realOrigin) {
      modifiedHeaders.set("X-Forwarded-For", realOrigin);
    }

    // ارسال درخواست به مقصد
    const response = await fetch(bridgeUrl, {
      method: request.method,
      headers: modifiedHeaders,
      body: request.body,
      redirect: "manual",
      // این بخش برای استریمینگ داده در Edge حیاتی است
      duplex: "half", 
    });

    return response;

  } catch (err) {
    return new Response("Service Unavailable", { status: 503 });
  }
}
