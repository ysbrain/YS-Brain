module.exports = {
  globDirectory: "dist",

  /*
   * Precache only files created as part of the deployed app.
   * This does not precache live Firestore, Authentication,
   * or Firebase Storage network responses.
   */
  globPatterns: [
    "**/*.{html,js,css,json,png,jpg,jpeg,svg,webp,ico,woff,woff2,ttf}",
  ],

  swDest: "dist/sw.js",

  cleanupOutdatedCaches: true,

  skipWaiting: true,

  clientsClaim: true,

  navigateFallback: "/index.html",

  navigateFallbackDenylist: [
    /^\/__/,
    /^\/api\//,
  ],

  runtimeCaching: [
    /*
     * Firebase Authentication, Firestore, Storage,
     * Installations, and Messaging endpoints.
     */
    {
      urlPattern: ({ url }) => {
        const hostname = url.hostname;

        return (
          hostname === "identitytoolkit.googleapis.com" ||
          hostname === "securetoken.googleapis.com" ||
          hostname === "firestore.googleapis.com" ||
          hostname === "firebaseinstallations.googleapis.com" ||
          hostname === "fcmregistrations.googleapis.com" ||
          hostname === "fcm.googleapis.com" ||
          hostname === "firebasestorage.googleapis.com" ||
          hostname.endsWith(".firebasestorage.app") ||
          hostname.endsWith(".appspot.com")
        );
      },

      handler: "NetworkOnly",
    },

    /*
     * Same-origin application API requests.
     */
    {
      urlPattern: ({ sameOrigin, url }) => {
        return sameOrigin && url.pathname.startsWith("/api/");
      },

      handler: "NetworkOnly",
    },

    /*
     * Firebase Hosting reserved resources.
     */
    {
      urlPattern: ({ sameOrigin, url }) => {
        return sameOrigin && url.pathname.startsWith("/__/");
      },

      handler: "NetworkOnly",
    },

    /*
     * Page navigation.
     */
    {
      urlPattern: ({ request, sameOrigin, url }) => {
        if (!sameOrigin) {
          return false;
        }

        if (request.mode !== "navigate") {
          return false;
        }

        if (
          url.pathname.startsWith("/api/") ||
          url.pathname.startsWith("/__/")
        ) {
          return false;
        }

        return true;
      },

      handler: "NetworkFirst",

      options: {
        cacheName: "ys-brain-pages",

        networkTimeoutSeconds: 5,

        cacheableResponse: {
          statuses: [0, 200],
        },

        expiration: {
          maxEntries: 30,
          maxAgeSeconds: 7 * 24 * 60 * 60,
        },
      },
    },

    /*
     * Same-origin static images.
     */
    {
      urlPattern: ({ request, sameOrigin }) => {
        return (
          sameOrigin &&
          request.method === "GET" &&
          request.destination === "image"
        );
      },

      handler: "StaleWhileRevalidate",

      options: {
        cacheName: "ys-brain-static-images",

        cacheableResponse: {
          statuses: [0, 200],
        },

        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
      },
    },

    /*
     * Same-origin static fonts.
     */
    {
      urlPattern: ({ request, sameOrigin }) => {
        return (
          sameOrigin &&
          request.method === "GET" &&
          request.destination === "font"
        );
      },

      handler: "CacheFirst",

      options: {
        cacheName: "ys-brain-static-fonts",

        cacheableResponse: {
          statuses: [0, 200],
        },

        expiration: {
          maxEntries: 30,
          maxAgeSeconds: 365 * 24 * 60 * 60,
        },
      },
    },
  ],
};
