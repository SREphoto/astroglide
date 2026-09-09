import { createFileRoute } from "@tanstack/react-router";
import CosmicExplorerApp from "@/game/App";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <CosmicExplorerApp />;
}
