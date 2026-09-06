    bounce.size = 980.0 * ISLAND_SCALE
    bounce.color = (0.62, 0.70, 0.90)
    bo = bpy.data.objects.new("Bounce", bounce)
    bo.location = (420.0 * ISLAND_SCALE, 180.0 * ISLAND_SCALE, -40.0 * ISLAND_SCALE)