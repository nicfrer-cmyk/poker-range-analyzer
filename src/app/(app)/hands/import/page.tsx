import { HandHistoryImporter } from "@/components/importer/HandHistoryImporter";

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">ייבוא היסטוריית ידיים</h1>
      <HandHistoryImporter />
    </div>
  );
}
