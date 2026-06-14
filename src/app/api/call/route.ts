/** Legacy PulseRoute endpoint — disabled in production evora */
export async function POST() {
  return Response.json({ error: "This endpoint is no longer available." }, { status: 410 });
}
