import { Card, CardContent, Typography, Box } from '@mui/material'

const StatsCard = ({ title, value, icon, color, trend, onClick }) => {
    return (
        <Card
            onClick={onClick}
            sx={{
                height: '100%',
                elevation: 3,
                cursor: onClick ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                '&:hover': onClick ? {
                    transform: 'translateY(-3px)',
                    boxShadow: 6,
                } : {},
            }}
        >
            <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                        <Typography color="text.secondary" variant="overline" display="block">
                            {title}
                        </Typography>
                        <Typography variant="h4" component="div" sx={{ mt: 1, fontWeight: 'bold' }}>
                            {value}
                        </Typography>
                    </Box>
                    <Box sx={{
                        backgroundColor: `${color}.light`,
                        color: `${color}.main`,
                        borderRadius: '50%',
                        p: 1,
                        display: 'flex'
                    }}>
                        {icon}
                    </Box>
                </Box>
                {trend && (
                    <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
                        <Typography
                            variant="body2"
                            color={trend.startsWith('+') ? 'success.main' : 'error.main'}
                            sx={{ fontWeight: 'bold', mr: 1 }}
                        >
                            {trend}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Since last hour
                        </Typography>
                    </Box>
                )}
            </CardContent>
        </Card>
    )
}

export default StatsCard