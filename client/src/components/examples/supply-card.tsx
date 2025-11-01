import { SupplyCard } from '../supply-card';

export default function SupplyCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      <SupplyCard
        id="1"
        name="Insulin Pen Needles"
        type="needle"
        currentQuantity={45}
        dailyUsage={4}
      />
      <SupplyCard
        id="2"
        name="NovoRapid FlexPen"
        type="insulin"
        currentQuantity={15}
        dailyUsage={3}
      />
      <SupplyCard
        id="3"
        name="CGM Sensor"
        type="cgm"
        currentQuantity={2}
        dailyUsage={0.1}
      />
    </div>
  );
}
