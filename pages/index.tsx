// pages/index.tsx - Main page

import DiscordDashboard from "@/components/DiscordDashboard";
import Head from "next/head";

export default function Home() {
  return (
    <>
      <Head>
        <title>Discord Multi-Tool | Serverless Dashboard</title>
        <meta
          name="description"
          content="Validate and manage Discord accounts with advanced security checks"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <DiscordDashboard />
    </>
  );
}
