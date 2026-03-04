import { Box } from '@mui/material'
import Sidebar from './Sidebar.jsx'
import TopBar from './TopBar.jsx'

const MainLayout = ({ children }) => {
    return (
        <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            <Sidebar />
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <TopBar />
                <Box sx={{ flex: 1, overflow: 'auto', p: 3, bgcolor: 'background.default' }}>
                    {children}
                </Box>
            </Box>
        </Box>
    )
}

export default MainLayout