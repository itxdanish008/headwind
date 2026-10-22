import './PageLoading.css'

export default function PageLoading() {
  return (
    <div className="page-loading" role="status" aria-busy="true">
      <span className="sr-only">Loading</span>
    </div>
  )
}
