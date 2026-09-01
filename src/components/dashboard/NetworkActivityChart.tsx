import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  YAxis,
  Tooltip,
  XAxis,
} from "recharts";

interface DataPoint {
  t: number;
  tps: number;
  blocks: number;
}

const generateInitial = (): DataPoint[] => {
  const data: DataPoint[] = [];
  for (let i = 30; i > 0; i--) {
    data.push({
      t: i,
      tps: Math.floor(180000 + Math.random() * 60000),
      blocks: Math.floor(2 + Math.random() * 3),
    });
  }
  return data;
};

export const NetworkActivityChart = () => {
  const [data, setData] = useState<DataPoint[]>(generateInitial);

  useEffect(() => {
    const interval = setInterval(() => {
      setData((prev) => {
        const next = [
          ...prev.slice(1),
          {
            t: prev[prev.length - 1].t + 1,
            tps: Math.floor(180000 + Math.random() * 70000),
            blocks: Math.floor(2 + Math.random() * 3),
          },
        ];
        return next;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="tpsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="hsl(150 100% 45%)"
                stopOpacity={0.35}
              />
              <stop
                offset="100%"
                stopColor="hsl(150 100% 45%)"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" hide />
          <YAxis hide domain={["dataMin - 10000", "dataMax + 10000"]} />
          <Tooltip
            contentStyle={{
              background: "hsl(150 14% 8%)",
              border: "1px solid hsl(150 14% 18%)",
              borderRadius: "0.5rem",
              fontSize: "11px",
              fontFamily: "JetBrains Mono, monospace",
            }}
            labelStyle={{ display: "none" }}
            formatter={(v: number) => [
              `${v.toLocaleString()} TPS`,
              "Throughput",
            ]}
          />
          <Area
            type="monotone"
            dataKey="tps"
            stroke="hsl(150 100% 45%)"
            strokeWidth={1.5}
            fill="url(#tpsGrad)"
            animationDuration={300}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
