import { useNavigate } from 'react-router-dom'
import { useRestaurantStore } from '../../store/useRestaurantStore'
import TableUnlockForm from '../../components/TableUnlockForm'
import Logo from '../../components/Logo'

export default function UnlockTable() {
  const navigate = useNavigate()
  const tables = useRestaurantStore((s) => s.tables)

  return (
    <div className="flex min-h-full items-center justify-center px-5 py-14">
      <div className="flex w-full max-w-sm flex-col items-center">
        <div className="mb-8">
          <Logo size="md" to="/" />
        </div>
        <TableUnlockForm
          tables={tables}
          onUnlocked={(tableId) => navigate(`/mesa/${tableId}`, { replace: true })}
        />
      </div>
    </div>
  )
}
