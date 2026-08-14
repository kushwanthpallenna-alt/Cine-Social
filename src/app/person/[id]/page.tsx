import React from "react";
import PersonDetailClient from "@/components/PersonDetailClient";

export default async function PersonDynamicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PersonDetailClient personId={id} />;
}
