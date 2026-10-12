import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useList } from '../../api/hooks'
import type { Payment } from '../../api/types'
import {
  EmptyState,
  ErrorNote,
  StatusBadge,
} from '../../components/ui/Feedback'
import { Select } from '../../components/ui/Form'
import { PageHeader } from '../../components/ui/Layout'
import { Column, DataTable, Pagination } from '../../components/ui/Table'
import { useI18n } from '../../i18n'
import { fmtDate, label, money } from '../../lib/format'

export default function PaymentsPage() {
  const { t } = useI18n()
  const [method, setMethod] = useState('')
  const [page, setPage] = useState(1)
  const q = useList<Payment>('payments', {
    method: method || undefined,
    page,
    page_size: 25,
  })
  const columns: Column<Payment>[] = [
    { key: 'd', header: 'Date', cell: (p) => fmtDate(p.paid_on) },
    {
      key: 'i',
      header: 'Invoice',
      cell: (p) => (
        <Link
          className="font-medium hover:underline"
          to={`/invoices/${p.invoice}`}
        >
          {p.invoice_number}
        </Link>
      ),
    },
    { key: 'm', header: 'Method', cell: (p) => label(p.method) },
    {
      key: 'r',
      header: 'Reference',
      cell: (p) => p.reference || <span className="text-muted">—</span>,
    },
    {
      key: 's',
      header: 'Status',
      cell: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: 'a',
      header: 'Amount',
      align: 'right',
      cell: (p) => <span className="font-medium">{money(p.amount)}</span>,
    },
    {
      key: 'x',
      header: '',
      align: 'right',
      cell: (p) => (
        <Link
          className="btn btn-secondary btn-sm"
          to={`/payments/${p.id}/receipt`}
        >
          {p.receipt_number || 'Receipt'}
        </Link>
      ),
    },
  ]
  return (
    <>
      <PageHeader title={t('nav.payments', 'Payments')} />
      <div className="mb-4">
        <Select
          className="w-48"
          aria-label="Method"
          value={method}
          onChange={(e) => {
            setMethod(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Any method</option>
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="mobile_money">Mobile money</option>
          <option value="online">Online</option>
        </Select>
      </div>
      {q.isError ? (
        <ErrorNote message="Couldn't load payments." />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={q.data?.results}
            rowKey={(p) => p.id}
            loading={q.isLoading}
            empty={<EmptyState title="No payments yet" />}
          />
          <Pagination
            page={page}
            pageSize={25}
            count={q.data?.count ?? 0}
            onChange={setPage}
          />
        </>
      )}
    </>
  )
}
