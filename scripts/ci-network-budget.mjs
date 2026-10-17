import http from "node:http";
import https from "node:https";

// CI build only (NODE_OPTIONS --import). Next's Google font loader uses the
// Node global agents and downloads Korean subsets concurrently. Keep real
// CSS/font fetching and TLS verification, but bound simultaneous connections.
// This does not alter the deployed application's fetch or font selection.
for (const protocol of [http, https]) {
  protocol.globalAgent.maxSockets = 4;
  protocol.globalAgent.maxTotalSockets = 8;
  protocol.globalAgent.maxFreeSockets = 2;
}
console.info("[ci-network] bounded agents", {
  perOrigin: 4,
  totalPerProtocol: 8,
  proxyConfigured: Boolean(process.env.https_proxy || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.HTTP_PROXY),
});
