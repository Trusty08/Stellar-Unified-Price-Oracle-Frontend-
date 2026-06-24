import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { usePriceHistory } from '../hooks/usePriceHistory'
import { usePriceContext } from '../context/PriceContext'
import { useAlerts } from '../hooks/useAlerts'
import { useExport } from '../hooks/useExport'
import { PriceChart } from '../components/PriceChart'
import { SourceHealthBadge } from '../components/SourceHealthBadge'
import { ConnectionBadge } from '../components/ConnectionBadge'
import { AlertBadge } from '../components/AlertBadge'
import { AlertModal } from '../components/AlertModal'
import { ExportButton } from '../components/ExportButton'
import { DateRangePicker, dateRangeToParams, type DateRange } from '../components/DateRangePicker'
import { formatPrice, formatTimestamp } from '../utils/format'
import type { Alert, AlertFormData } from '../types'

function parseDateRange(searchParams: URLSearchParams): DateRange {
  const preset = searchParams.get('preset')
  const startDate = searchParams.get('startDate') ?? ''
  const endDate = searchParams.get('endDate') ?? ''

  const validPresets = ['1h', '24h', '7d', '30d', '1y', 'all', 'custom']
  if (preset && validPresets.includes(preset)) {
    return { preset: preset as DateRange['preset'], startDate, endDate }
  }
  return { preset: '24h', startDate: '', endDate: '' }
}
import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePriceContext } from '../context/PriceContext'
import { useAlerts } from '../hooks/useAlerts'
import { AlertModal } from '../components/AlertModal'
import type { AlertFormData } from '../types'

export function PriceDetail() {
  const { pair } = useParams<{ pair: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const decodedPair = pair ? decodeURIComponent(pair) : null

  const [dateRange, setDateRange] = useState<DateRange>(() => parseDateRange(searchParams))

  const historyParams = useMemo(() => dateRangeToParams(dateRange), [dateRange])

  const { history, loading: historyLoading } = usePriceHistory(decodedPair, historyParams)
  const { prices, livePrices, wsStatus, subscribe, unsubscribe } = usePriceContext()
  const { alerts, addAlert, updateAlert, removeAlert, getAlertsForPair, hasAlertsForPair } =
    useAlerts()

  const { exporting, exportHistory } = useExport()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null)

  const handleDateRangeChange = useCallback(
    (range: DateRange) => {
      setDateRange(range)
      const params = new URLSearchParams(searchParams)
      params.set('preset', range.preset)
      if (range.startDate) params.set('startDate', range.startDate)
      else params.delete('startDate')
      if (range.endDate) params.set('endDate', range.endDate)
      else params.delete('endDate')
      setSearchParams(params, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  useEffect(() => {
    if (decodedPair) subscribe([decodedPair])
    return () => {
      if (decodedPair) unsubscribe([decodedPair])
    }
  }, [decodedPair, subscribe, unsubscribe])

  const liveEntry = livePrices.get(decodedPair ?? '')
  const priceData = liveEntry?.data ?? prices.find((p) => p.assetPair === decodedPair)

  const handleOpenModal = useCallback(() => {
    const existing = alerts.find((a) => a.assetPair === decodedPair && a.active)
    setEditingAlert(existing ?? null)
    setModalOpen(true)
  }, [alerts, decodedPair])

  const handleSave = useCallback(
    (data: AlertFormData) => {
      if (editingAlert) {
        updateAlert(editingAlert.id, {
          upperThreshold: data.upperThreshold ? Number.parseFloat(data.upperThreshold) : null,
          lowerThreshold: data.lowerThreshold ? Number.parseFloat(data.lowerThreshold) : null,
          triggerOnce: data.triggerOnce,
        })
      } else {
        addAlert({
          assetPair: data.assetPair,
          upperThreshold: data.upperThreshold ? Number.parseFloat(data.upperThreshold) : null,
          lowerThreshold: data.lowerThreshold ? Number.parseFloat(data.lowerThreshold) : null,
          triggerOnce: data.triggerOnce,
          active: true,
        })
      }
      setModalOpen(false)
      setEditingAlert(null)
    },
    [editingAlert, addAlert, updateAlert],
  )

  const handleDelete = useCallback(() => {
    if (editingAlert) {
      removeAlert(editingAlert.id)
      setModalOpen(false)
      setEditingAlert(null)
    }
  }, [editingAlert, removeAlert])

  if (!decodedPair) {
    navigate('/')
    return null
  }

  const pairAlerts = getAlertsForPair(decodedPair)

  const decodedPair = pair ? decodeURIComponent(pair) : ''
  const { prices, livePrices } = usePriceContext()
  const { alerts, addAlert, removeAlert } = useAlerts()

  const [modalOpen, setModalOpen] = useState(false)

  const price = prices.find((p) => p.assetPair === decodedPair)
  const live = decodedPair ? livePrices.get(decodedPair) : undefined
  const displayData = live ? live.data : price

  const handleSave = useCallback(
    (data: AlertFormData) => {
      addAlert({
        assetPair: data.assetPair,
        upperThreshold: data.upperThreshold ? Number.parseFloat(data.upperThreshold) : null,
        lowerThreshold: data.lowerThreshold ? Number.parseFloat(data.lowerThreshold) : null,
        triggerOnce: data.triggerOnce,
        active: true,
      })
      setModalOpen(false)
    },
    [addAlert],
  )

  if (!displayData) {
    return (
      <div className="text-center py-32 text-gray-500">
        <p className="text-lg mb-2">Price feed not found</p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 rounded-lg text-sm font-medium hover:bg-cyan-500/20 transition-colors cursor-pointer"
        >
          Back to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => navigate('/')}
        className="mb-6 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors flex items-center gap-1 cursor-pointer"
        type="button"
        aria-label="Back to Dashboard"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
        className="mb-6 flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        aria-label="Back to Dashboard"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </button>

      {priceData && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-white">{decodedPair}</h1>
                {hasAlertsForPair(decodedPair) && (
                  <span className="w-2 h-2 rounded-full bg-amber-400" role="status" aria-label="Active alert" />
                )}
                {liveEntry && (
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                )}
                {liveEntry?.syncState === 'optimistic' && (
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                    Optimistic update
                  </span>
                )}
                {liveEntry?.syncState === 'rollback' && (
                  <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-300">
                    REST corrected
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Last updated: {formatTimestamp(priceData.timestamp)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ExportButton
                onExport={(fmt) => exportHistory(decodedPair, history, fmt)}
                exporting={exporting}
                disabled={history.length === 0}
              />
              <AlertBadge count={pairAlerts.length} alerts={pairAlerts} onClick={handleOpenModal} />
              <span className="text-sm text-cyan-400">
                {(priceData.confidence * 100).toFixed(1)}% confidence
              </span>
              <ConnectionBadge status={wsStatus} />
            </div>
          </div>

          <div
            className={`text-5xl font-bold text-gray-900 dark:text-white mb-4 font-mono tracking-tight transition-colors duration-700 ${
              liveEntry?.syncState === 'confirmed'
                ? 'text-emerald-300'
                : liveEntry?.syncState === 'rollback'
                  ? 'text-rose-300'
                  : ''
            }`}
          >
            ${formatPrice(priceData.price)}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-2">Oracle Sources</p>
              <SourceHealthBadge sources={priceData.sources} />
            </div>
            <button
              type="button"
              onClick={handleOpenModal}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-colors ${hasAlertsForPair(decodedPair) ? 'text-amber-400 bg-amber-400/10 border border-amber-400/20 hover:bg-amber-400/20' : 'text-gray-400 bg-gray-800 border border-gray-700 hover:bg-gray-700 hover:text-gray-300'}`}
              aria-label={hasAlertsForPair(decodedPair) ? 'Manage alerts' : 'Set price alert'}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"
                />
              </svg>
              {hasAlertsForPair(decodedPair) ? 'Manage Alert' : 'Set Alert'}
            </button>
          </div>
        </div>
      )}

      {!priceData && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8 flex items-center justify-between text-gray-500">
          <p>{historyLoading ? 'Loading...' : `No price data for ${decodedPair}`}</p>
          <button
            type="button"
            onClick={handleOpenModal}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-400 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700 hover:text-gray-300 transition-colors"
            aria-label="Set price alert"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"
              />
            </svg>
            Set Alert
          </button>
        </div>
      )}

      <div className="mb-4">
        <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />
      </div>

      <PriceChart data={history} pair={decodedPair} loading={historyLoading} />

      <AlertModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingAlert(null)
        }}
        onSave={handleSave}
        onDelete={editingAlert ? handleDelete : undefined}
        alert={editingAlert}
        currentPrice={priceData?.price}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">{decodedPair}</h1>
            <p className="text-sm text-gray-400 mt-1">
              Updated {new Date(displayData.timestamp).toLocaleString()}
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-900/40 text-amber-400 border border-amber-800/50 rounded-lg text-sm font-medium hover:bg-amber-900/60 transition-colors cursor-pointer"
            aria-label="Set price alert"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Set price alert
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Price</p>
            <p className="text-2xl font-bold text-white">
              ${displayData.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Confidence</p>
            <p className="text-2xl font-bold text-cyan-400">
              {(displayData.confidence * 100).toFixed(1)}% confidence
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Sources</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {displayData.sources.map((source) => (
                <span key={source} className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">
                  {source}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AlertModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        alert={alerts.find((a) => a.assetPair === decodedPair) ?? null}
        defaultAssetPair={decodedPair}
        onDelete={
          alerts.find((a) => a.assetPair === decodedPair)
            ? () => {
                const existing = alerts.find((a) => a.assetPair === decodedPair)
                if (existing) removeAlert(existing.id)
                setModalOpen(false)
              }
            : undefined
        }
      />
    </div>
  )
}
