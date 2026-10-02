using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Topout.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddExerciseMuscleGroups : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int[]>(
                name: "MuscleGroups",
                table: "Exercises",
                type: "integer[]",
                nullable: false,
                defaultValue: new int[0]
            );
            migrationBuilder.Sql(
                """
                UPDATE "Exercises"
                SET "MuscleGroups" = CASE WHEN "MuscleGroup" = 0 THEN ARRAY[]::integer[]
                    ELSE ARRAY["MuscleGroup"] END;
                """
            );
            migrationBuilder.DropColumn(name: "MuscleGroup", table: "Exercises");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "MuscleGroup",
                table: "Exercises",
                type: "integer",
                nullable: false,
                defaultValue: 0
            );
            // A downgrade can retain only the first selected group.
            migrationBuilder.Sql(
                """
                UPDATE "Exercises" SET "MuscleGroup" = COALESCE("MuscleGroups"[1], 0);
                """
            );
            migrationBuilder.DropColumn(name: "MuscleGroups", table: "Exercises");
        }
    }
}
