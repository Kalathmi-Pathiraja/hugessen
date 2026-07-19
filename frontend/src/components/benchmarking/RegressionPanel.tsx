import { CalculationResponse, PayMetric, SizeMetric, PAY_METRIC_LABELS, SIZE_METRIC_LABELS } from '../../types/BenchmarkingTypes'
import RegressionScatterPlot from './RegressionScatterPlot'
import HangingBarChart from './HangingBarChart'
import PeerWeightTable from './PeerWeightTable'

interface Props {
  results: Partial<Record<PayMetric, CalculationResponse>>
  analysisMetric: PayMetric
  onAnalysisMetricChange: (m: PayMetric) => void
  sizeMetric: SizeMetric
  onSizeMetricChange: (m: SizeMetric) => void
  clientSize: number | null
  currency: string
  onApplyWeights: (weights: Record<string, number>) => void
  onResetToSuggested: () => void
  applying: boolean
}

const PAY_METRICS: PayMetric[] = ['base', 'tcc', 'tdc', 'total_comp']
const SIZE_METRICS: SizeMetric[] = ['market_cap', 'tev', 'revenue', 'total_assets']

export default function RegressionPanel({
  results, analysisMetric, onAnalysisMetricChange, sizeMetric, onSizeMetricChange,
  clientSize, currency, onApplyWeights, onResetToSuggested, applying,
}: Props) {
  const analysisCalc = results[analysisMetric]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-10">
        <div>
          <label className="block text-[11px] font-semibold text-charcoal uppercase tracking-wide mb-1.5">Size Metric</label>
          <div className="flex gap-1.5">
            {SIZE_METRICS.map(m => (
              <button
                key={m}
                onClick={() => onSizeMetricChange(m)}
                className={`px-3.5 py-[7px] rounded border text-[12.5px] font-semibold transition-colors ${
                  m === sizeMetric
                    ? 'bg-navy text-white border-navy'
                    : 'bg-white text-charcoal border-gray300 hover:border-navy hover:text-navy'
                }`}
              >
                {SIZE_METRIC_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-charcoal uppercase tracking-wide mb-1.5">Regression Pay Metric</label>
          <div className="flex gap-1.5">
            {PAY_METRICS.map(m => (
              <button
                key={m}
                onClick={() => onAnalysisMetricChange(m)}
                className={`px-3.5 py-[7px] rounded border text-[12.5px] font-semibold transition-colors ${
                  m === analysisMetric
                    ? 'bg-navy text-white border-navy'
                    : 'bg-white text-charcoal border-gray300 hover:border-navy hover:text-navy'
                }`}
              >
                {PAY_METRIC_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {analysisCalc && (
          <RegressionScatterPlot
            calc={analysisCalc} clientSize={clientSize} currency={currency}
            payMetricLabel={PAY_METRIC_LABELS[analysisMetric]}
            sizeMetricLabel={SIZE_METRIC_LABELS[sizeMetric]}
          />
        )}
        {analysisCalc && (
          <HangingBarChart
            label={PAY_METRIC_LABELS[analysisMetric]}
            p25={analysisCalc.weighted.p25}
            p50={analysisCalc.weighted.p50}
            p75={analysisCalc.weighted.p75}
            avg={analysisCalc.weighted.avg}
            clientPay={analysisCalc.client_pay}
            clientPercentile={analysisCalc.client_percentile_weighted}
            currency={currency}
            weighted
          />
        )}
      </div>

      {analysisCalc && (
        <PeerWeightTable
          peers={analysisCalc.peers}
          currency={currency}
          onApply={onApplyWeights}
          onResetToSuggested={onResetToSuggested}
          applying={applying}
        />
      )}
    </div>
  )
}
