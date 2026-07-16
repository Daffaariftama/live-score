import { scoreEmitter } from "~/server/event-emitter";

export const dynamic = "force-dynamic";

export async function GET() {
  let onUpdate: (payload?: string) => void;
  let keepAlive: NodeJS.Timeout;

  const responseStream = new ReadableStream({
    start(controller) {
      onUpdate = (payload) => {
        try {
          const data = payload ?? "update";
          controller.enqueue(`data: ${data}\n\n`);
        } catch (err) {
          // Ignored
        }
      };

      scoreEmitter.on("update", onUpdate);

      // Send a comment every 15 seconds to keep the connection alive
      keepAlive = setInterval(() => {
        try {
          controller.enqueue(": keepalive\n\n");
        } catch (err) {
          // Ignored
        }
      }, 15000);
    },
    cancel() {
      if (onUpdate) {
        scoreEmitter.off("update", onUpdate);
      }
      if (keepAlive) {
        clearInterval(keepAlive);
      }
    },
  });

  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
