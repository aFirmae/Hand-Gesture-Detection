const supabase = require('../config/supabase');

const requireAuth = async (req, res, next) => {
    const session = req.session.user;
    
    if (!session) {
        return res.redirect('/auth');
    }

    try {
        const { data: { user }, error } = await supabase.auth.getUser(session.access_token);
        
        if (error || !user) {
            req.session.destroy();
            return res.redirect('/auth');
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Auth error:', error);
        res.redirect('/auth');
    }
};

module.exports = { requireAuth };